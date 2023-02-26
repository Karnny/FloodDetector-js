import http from "http";
import net from "net";
import { TCPPacket } from "./lib/TCPPacket";
const PORT = process.env.PORT || 3008;

const MAX_HTTP_REQUEST_PER_SECOND: number = 3000;
const MAX_TCP_CONNECTION_PER_SECOND: number = 3000;
const IS_PRIME_TIME: boolean = false;
const STATISTIC_ACCEPTABLE_LOAD_PERCENTAGE: number = 80;
const IP_HTTP_REQUESTS_COUNT: Map<string, any> = new Map();
const IP_CONNECTION_COUNT: Map<string, any> = new Map();
const IP_BLOCK_LIST: Map<string, any> = new Map();

const TRIGGERED_RULES: Array<any> = [];

// Periodically print the requests per second for each IP address
setInterval(() => {
  console.clear();
  console.log("HTTP requests per second:");
  IP_HTTP_REQUESTS_COUNT.forEach((count: number, ip: string) => {
    console.log(`${ip}: ${IP_HTTP_REQUESTS_COUNT.get(ip)}`);
    IP_HTTP_REQUESTS_COUNT.set(ip, 0);
  });
  console.log("TCP connection requests per second:");
  IP_CONNECTION_COUNT.forEach((count: number, ip: string) => {
    console.log(`${ip}: ${IP_CONNECTION_COUNT.get(ip)}`);
    IP_CONNECTION_COUNT.set(ip, 0);
  });

  console.log("Triggered rules: ", TRIGGERED_RULES);
}, 1000);

function calculatePecentage(part: number, whole: number): number {
  return (part / whole) * 100;
}

async function blockRequest(socket: net.Socket, cb: any) {
  const message = "Blocked";

  socket.write(
    `HTTP/1.1 403 Forbidden\r\nContent-Length: ${message.length}\r\nContent-Type: text/plain\r\n\r\n${message}\n`
  );
  socket.end();
  return cb();
}

let server: net.Server;
try {
  server = net.createServer(async (socket: net.Socket) => {
    socket.on("error", (err) => {
      console.log("Socket error", err);
    });

    const ip: string = socket.remoteAddress || "Unknown";
    // console.log(
    //   `Client connected: ${ip}:${req.socket.remotePort}`
    // );

    // Create IP record in request counting list
    if (!IP_HTTP_REQUESTS_COUNT.get(ip)) {
      IP_HTTP_REQUESTS_COUNT.set(ip, 0);
    }

    if (!IP_CONNECTION_COUNT.get(ip)) {
      IP_CONNECTION_COUNT.set(ip, 0);
    }

    // Check if current IP is in block list
    if (![null, undefined].includes(IP_BLOCK_LIST.get(ip))) {
      blockRequest(socket, () => {
        console.log(`Blocked request from block list: ${ip}`);
      });
      return;
    }

    IP_CONNECTION_COUNT.set(ip, IP_CONNECTION_COUNT.get(ip) + 1);

    if (IP_CONNECTION_COUNT.get(ip)! > MAX_TCP_CONNECTION_PER_SECOND) {
      blockRequest(socket, () => {
        IP_BLOCK_LIST.set(ip, 1);
        !TRIGGERED_RULES.includes("RP3") ? TRIGGERED_RULES.push("RP3") : null;
        console.log(
          `Blocked exceeded TCP request(${MAX_HTTP_REQUEST_PER_SECOND} RPS) from: ${ip}`
        );
      });
      return;
    }

    const connectionUtilizationPercentage = calculatePecentage(
      IP_CONNECTION_COUNT.get(ip),
      MAX_TCP_CONNECTION_PER_SECOND
    );
    if (
      connectionUtilizationPercentage > STATISTIC_ACCEPTABLE_LOAD_PERCENTAGE &&
      !IS_PRIME_TIME
    ) {
      blockRequest(socket, () => {
        IP_BLOCK_LIST.set(ip, 1);
        !TRIGGERED_RULES.includes("RP2, PSRP3, RV*")
          ? TRIGGERED_RULES.push("RP2, PSRP3, RV*")
          : null;
        console.log(
          `Blocked TCP connection exceeded ${STATISTIC_ACCEPTABLE_LOAD_PERCENTAGE}% utilization from: ${ip}`
        );
      });
    }
    // Application HTTP request layer
    socket.on("data", (data) => {
      // Parse the request method and URL from the request data
      const [requestLine, ...headers] = data.toString().split("\r\n");
      const [method, url] = requestLine.split(" ");

      if (![null, undefined, ""].includes(method)) {
        IP_HTTP_REQUESTS_COUNT.set(ip, IP_HTTP_REQUESTS_COUNT.get(ip) + 1);

        const utilizationPercentage = calculatePecentage(
          IP_HTTP_REQUESTS_COUNT.get(ip),
          MAX_HTTP_REQUEST_PER_SECOND
        );
        if (
          utilizationPercentage > STATISTIC_ACCEPTABLE_LOAD_PERCENTAGE &&
          !IS_PRIME_TIME
        ) {
          blockRequest(socket, () => {
            IP_BLOCK_LIST.set(ip, 1);
            !TRIGGERED_RULES.includes("RA2, ASRP3, RV*")
              ? TRIGGERED_RULES.push("RA2, ASRP3, RV*")
              : null;
            console.log(
              `Blocked HTTP request exceeded ${STATISTIC_ACCEPTABLE_LOAD_PERCENTAGE}% utilization from: ${ip}`
            );
          });
          return;
        }
      }

      function checkHTTPRequest(cb: any, rule: any) {
        if (IP_HTTP_REQUESTS_COUNT.get(ip)! > MAX_HTTP_REQUEST_PER_SECOND) {
          blockRequest(socket, () => {
            IP_BLOCK_LIST.set(ip, 1);
            !TRIGGERED_RULES.includes(rule) ? TRIGGERED_RULES.push(rule) : null;
            console.log(
              `Blocked exceeded HTTP request(${MAX_HTTP_REQUEST_PER_SECOND} RPS) from: ${ip}`
            );
          });
          return;
        } else {
          return cb();
        }
      }
      // Handle GET request
      if (method === "GET") {
        checkHTTPRequest(() => {
          const response =
            "HTTP/1.1 200 OK\r\nContent-Length: 12\r\nContent-Type: text/plain\r\n\r\nHello World!\n";
          socket.write(response);
          socket.end();
        }, "RA3");
      }

      if (method === "POST") {
        checkHTTPRequest(() => {
          let body = "";
          for (const header of headers) {
            if (header.toLowerCase().startsWith("content-length:")) {
              const contentLength = parseInt(header.split(":")[1].trim(), 10);
              body = data.toString().slice(-contentLength);
            }
          }
          const response = `HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nContent-Type: text/plain\r\n\r\n${body}\n`;
          socket.write(response);
          socket.end();
        }, "RA5");
      }
    });
  });

  server.on("error", (err) => {
    console.log("Server error", err);
  });

  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
} catch (e) {
  console.log("Socket error at server: ", e);
}

// server.on("data", (data: Buffer) => {
//   const tcpPacket: TCPPacket = parseTCPPacket(data);
//   console.log(data.toString());
//   console.log(tcpPacket);
//   if (tcpPacket.srcIP === IP_ADDRESS) {
//     if (tcpPacket.isSyn) {
//       synPacketCount++;
//       if (synPacketCount > MAX_SYN_PACKETS) {
//         console.log(`SYN flood detected from ${IP_ADDRESS}`);
//         // Take appropriate action (e.g., block IP address)
//       }
//     } else if (tcpPacket.isAck) {
//       ackPacketCount++;
//       if (ackPacketCount < MIN_ACK_PACKETS) {
//         console.log(`ACK flood detected from ${IP_ADDRESS}`);
//         // Take appropriate action (e.g., block IP address)
//       }
//     }
//   }

//   server.close();

// });

function parseTCPPacket(data: Buffer): TCPPacket {
  const packet = {
    srcPort: data.readUInt16BE(0),
    destPort: data.readUInt16BE(2),
    seqNum: data.readUInt32BE(4),
    ackNum: data.readUInt32BE(8),
    offset: data.readUInt8(12) >> 4,
    flags: data.readUInt16BE(12) & 0b111111,
    windowSize: data.readUInt16BE(14),
    checksum: data.readUInt16BE(16),
    urgentPtr: data.readUInt16BE(18),
  };

  // Parse IP addresses
  const srcIP: string = `${data[12]}.${data[13]}.${data[14]}.${data[15]}`;
  const destIP: string = `${data[16]}.${data[17]}.${data[18]}.${data[19]}`;

  // const srcIP: string = data.readInt16BE(0).toString();
  // const destIP: string = data.readInt16BE(0).toString();

  return new TCPPacket(
    srcIP,
    packet.srcPort,
    destIP,
    packet.destPort,
    packet.seqNum,
    packet.ackNum,
    packet.flags,
    packet.windowSize,
    packet.urgentPtr
  );
}
