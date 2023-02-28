export class TCPPacket {
  srcIP: any;
  srcPort: any;
  destIP: any;
  destPort: any;
  seqNum: any;
  ackNum: any;
  flags: any;
  isSyn: boolean;
  isAck: boolean;
  windowSize: number;
  urgentPtr: any;
  constructor(
    srcIP: string,
    srcPort: number,
    destIP: string,
    destPort: number,
    seqNum: number,
    ackNum: number,
    flags: number,
    windowSize: number,
    urgenPtr: any
  ) {
    this.srcIP = srcIP;
    this.srcPort = srcPort;
    this.destIP = destIP;
    this.destPort = destPort;
    this.seqNum = seqNum;
    this.ackNum = ackNum;
    this.flags = flags;
    this.isSyn = (flags & 2) !== 0;
    this.isAck = (flags & 16) !== 0;
    this.windowSize = windowSize;
    this.urgentPtr = urgenPtr;
    // other TCP packet fields
  }
}
