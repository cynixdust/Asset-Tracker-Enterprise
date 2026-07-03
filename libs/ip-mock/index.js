var v4Seg = '(?:[0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])';
var v4Regexp = new RegExp('^(' + v4Seg + '\\.){3}' + v4Seg + '$');

function isV4Format(ip) {
  return v4Regexp.test(ip);
}

var v6Regexp = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$|^([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}$|^([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}$|^([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}$|^([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})$|^:((:[0-9a-fA-F]{1,4}){1,7}|:)$|^fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}$|^::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$|^([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$/;

function isV6Format(ip) {
  return v6Regexp.test(ip);
}

function toLong(ip) {
  var ipl = 0;
  ip.split('.').forEach(function(octet) {
    ipl <<= 8;
    ipl += parseInt(octet, 10);
  });
  return ipl >>> 0;
}

function fromLong(ipl) {
  return [
    (ipl >>> 24) & 0xFF,
    (ipl >>> 16) & 0xFF,
    (ipl >>> 8) & 0xFF,
    ipl & 0xFF
  ].join('.');
}

function subnet(address, netmask) {
  var addressLong = toLong(address);
  var netmaskLong = toLong(netmask);
  var networkLong = (addressLong & netmaskLong) >>> 0;
  var firstAddressLong = (networkLong + 1) >>> 0;
  var broadcastLong = (networkLong | (~netmaskLong)) >>> 0;
  var lastAddressLong = (broadcastLong - 1) >>> 0;

  return {
    networkAddress: fromLong(networkLong),
    firstAddress: fromLong(firstAddressLong),
    lastAddress: fromLong(lastAddressLong),
    broadcastAddress: fromLong(broadcastLong),
    subnetMask: netmask,
    numHosts: Math.max(0, lastAddressLong - firstAddressLong + 2),
    length: Math.max(0, lastAddressLong - firstAddressLong + 2)
  };
}

module.exports = {
  isV4Format: isV4Format,
  isV6Format: isV6Format,
  toLong: toLong,
  fromLong: fromLong,
  subnet: subnet
};
