import zlib from "node:zlib";

/**
 * Calculates CRC32 for a Buffer using standard polynomial 0xEDB88320.
 */
function crc32(buf: Buffer): number {
  let table = (crc32 as any).table as Int32Array | undefined;
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    (crc32 as any).table = table;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

interface ZipEntry {
  name: string;
  data: string | Buffer;
}

/**
 * Creates an uncompressed / deflated standard PKZIP archive (PKZIP 2.0).
 */
export function createZipArchive(files: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, "utf-8");
    const rawData = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf-8");
    const crc = crc32(rawData);
    const deflated = zlib.deflateRawSync(rawData);

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract (2.0)
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(8, 8); // compression method (8 = deflate)
    localHeader.writeUInt16LE(0, 10); // file last modification time
    localHeader.writeUInt16LE(0, 12); // file last modification date
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(deflated.length, 18); // compressed size
    localHeader.writeUInt32LE(rawData.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26); // file name length
    localHeader.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, deflated);

    // Central directory file header (46 bytes + name)
    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central file header signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(8, 10); // compression method (8 = deflate)
    centralHeader.writeUInt16LE(0, 12); // file last modification time
    centralHeader.writeUInt16LE(0, 14); // file last modification date
    centralHeader.writeUInt32LE(crc, 16); // crc-32
    centralHeader.writeUInt32LE(deflated.length, 20); // compressed size
    centralHeader.writeUInt32LE(rawData.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28); // file name length
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + deflated.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const h of centralHeaders) {
    centralDirSize += h.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // number of the disk with the start of the central directory
  eocd.writeUInt16LE(files.length, 8); // total number of entries in the central directory on this disk
  eocd.writeUInt16LE(files.length, 10); // total number of entries in the central directory
  eocd.writeUInt32LE(centralDirSize, 12); // size of the central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // .ZIP file comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

function escapeXml(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getColLetter(idx: number): string {
  let letter = "";
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Generates a valid Microsoft Excel (.xlsx) file Buffer from a sheet name, headers, and rows.
 */
export function generateXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): Buffer {
  let sheetDataXml = "";

  // 1. Header row (r=1)
  sheetDataXml += '<row r="1" spans="1:' + headers.length + '">';
  headers.forEach((h, colIdx) => {
    const cellRef = `${getColLetter(colIdx)}1`;
    sheetDataXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
  });
  sheetDataXml += "</row>";

  // 2. Data rows (r=2, 3, ...)
  rows.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    sheetDataXml += `<row r="${rowNum}" spans="1:${headers.length}">`;
    row.forEach((val, colIdx) => {
      const cellRef = `${getColLetter(colIdx)}${rowNum}`;
      if (typeof val === "number") {
        sheetDataXml += `<c r="${cellRef}"><v>${val}</v></c>`;
      } else if (typeof val === "boolean") {
        sheetDataXml += `<c r="${cellRef}" t="b"><v>${val ? 1 : 0}</v></c>`;
      } else {
        const text = escapeXml(val);
        sheetDataXml += `<c r="${cellRef}" t="inlineStr"><is><t>${text}</t></is></c>`;
      }
    });
    sheetDataXml += "</row>";
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

  const safeSheetName = escapeXml(sheetName || "Auditorias").substring(0, 31);
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetDataXml}
  </sheetData>
</worksheet>`;

  return createZipArchive([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: relsXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/worksheets/sheet1.xml", data: sheet1Xml },
  ]);
}
