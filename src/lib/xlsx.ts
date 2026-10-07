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

export interface XlsxCellData {
  colIdx: number;
  value: string | number | boolean | null | undefined;
  styleId?: number;
}

export interface XlsxColWidth {
  colIdx: number;
  width: number;
}

export interface XlsxSheetDefinition {
  name: string;
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
  colWidths?: XlsxColWidth[];
  rawRows?: {
    rowNum: number;
    cells: XlsxCellData[];
  }[];
}

/**
 * Common style IDs used for rich formatted sheets:
 * 0: Normal / Default
 * 1: Header (Yellow fill #FFC000, Bold, Centered, Thin border)
 * 2: Header Left (Yellow fill #FFC000, Bold, Left, Thin border)
 * 3: Data Text (Regular font, Thin border)
 * 4: Data Centered (Regular font, Centered, Thin border)
 * 5: Data Percent (Format 0%, Centered, Thin border)
 * 6: Data Percent Two Decimals (Format 0.00%, Centered, Thin border)
 * 7: Cumple True (Soft Green fill #CEEFC6, Green text #006100, Centered, Thin border)
 * 8: Cumple False (Soft Red fill #FFC7CE, Red text #9C0006, Centered, Thin border)
 * 9: Status Aprobado (Soft Green fill #CEEFC6, Green text #006100, Bold, Centered, Thin border)
 * 10: Status Reprobado (Soft Red fill #FFC7CE, Red text #9C0006, Bold, Centered, Thin border)
 * 11: Summary Label (Bold, Centered, Thin border)
 */
export const XLSX_STYLE_INDEX = {
  DEFAULT: 0,
  HEADER_CENTER: 1,
  HEADER_LEFT: 2,
  DATA_TEXT: 3,
  DATA_CENTER: 4,
  DATA_PERCENT: 5,
  DATA_PERCENT_DECIMAL: 6,
  CUMPLE_TRUE: 7,
  CUMPLE_FALSE: 8,
  STATUS_APROBADO: 9,
  STATUS_REPROBADO: 10,
  SUMMARY_LABEL: 11,
} as const;

function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="164" formatCode="0%"/>
    <numFmt numFmtId="165" formatCode="0.00%"/>
  </numFmts>
  <fonts count="4">
    <!-- 0: Regular Calibri 10 -->
    <font><sz val="10"/><color rgb="FF000000"/><name val="Calibri"/></font>
    <!-- 1: Bold Calibri 10 -->
    <font><b/><sz val="10"/><color rgb="FF000000"/><name val="Calibri"/></font>
    <!-- 2: Green font for True -->
    <font><sz val="10"/><color rgb="FF006100"/><name val="Calibri"/></font>
    <!-- 3: Red font for False -->
    <font><sz val="10"/><color rgb="FF9C0006"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <!-- 0: none -->
    <fill><patternFill patternType="none"/></fill>
    <!-- 1: gray125 -->
    <fill><patternFill patternType="gray125"/></fill>
    <!-- 2: Header Yellow (#FFC000) -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFC000"/></patternFill></fill>
    <!-- 3: Cumple Green (#CEEFC6) -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFCEEFC6"/></patternFill></fill>
    <!-- 4: Cumple Red (#FFC7CE) -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/></patternFill></fill>
    <!-- 5: Soft Gray (#F2F2F2) -->
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/></patternFill></fill>
  </fills>
  <borders count="2">
    <!-- 0: none -->
    <border><left/><right/><top/><bottom/></border>
    <!-- 1: Thin all around -->
    <border>
      <left style="thin"><color rgb="FFD4D4D4"/></left>
      <right style="thin"><color rgb="FFD4D4D4"/></right>
      <top style="thin"><color rgb="FFD4D4D4"/></top>
      <bottom style="thin"><color rgb="FFD4D4D4"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="12">
    <!-- 0: DEFAULT -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <!-- 1: HEADER_CENTER (Yellow, Bold, Centered, Thin border) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: HEADER_LEFT (Yellow, Bold, Left, Thin border) -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <!-- 3: DATA_TEXT (Regular, Left, Thin border) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center"/>
    </xf>
    <!-- 4: DATA_CENTER (Regular, Centered, Thin border) -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 5: DATA_PERCENT (Format 0%, Centered, Thin border) -->
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 6: DATA_PERCENT_DECIMAL (Format 0.00%, Centered, Thin border) -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 7: CUMPLE_TRUE (Soft green, Green text, Centered, Thin border) -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 8: CUMPLE_FALSE (Soft red, Red text, Centered, Thin border) -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 9: STATUS_APROBADO (Soft green, Green text, Bold, Centered, Thin border) -->
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 10: STATUS_REPROBADO (Soft red, Red text, Bold, Centered, Thin border) -->
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 11: SUMMARY_LABEL (Bold, Centered, Thin border) -->
    <xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

/**
 * Generates a valid Microsoft Excel (.xlsx) file Buffer with multiple sheets and custom cell layout.
 */
export function generateMultiSheetXlsxBuffer(
  sheets: XlsxSheetDefinition[],
): Buffer {
  if (sheets.length === 0) {
    sheets = [{ name: "Hoja 1", headers: [], rows: [] }];
  }

  const sheetEntries: { sheetId: number; name: string; xml: string }[] = [];
  const contentTypesOverrides: string[] = [];
  const workbookSheetTags: string[] = [];
  const workbookRelsTags: string[] = [];

  // Register styles in workbook relations (rIdStyles)
  const stylesRelId = `rIdStyles`;
  workbookRelsTags.push(
    `<Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  );
  contentTypesOverrides.push(
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
  );

  const existingSheetNames = new Set<string>();

  sheets.forEach((sheetDef, idx) => {
    const sheetId = idx + 1;
    const rId = `rId${sheetId}`;

    let baseName = (sheetDef.name || `Hoja ${sheetId}`)
      .replace(/[\\/*?:\[\]]/g, "_")
      .trim()
      .substring(0, 31);
    if (!baseName) baseName = `Hoja ${sheetId}`;

    let uniqueName = baseName;
    let counter = 1;
    while (existingSheetNames.has(uniqueName.toLowerCase())) {
      const suffix = `_${counter}`;
      uniqueName = `${baseName.substring(0, 31 - suffix.length)}${suffix}`;
      counter++;
    }
    existingSheetNames.add(uniqueName.toLowerCase());

    const safeSheetName = escapeXml(uniqueName);

    workbookSheetTags.push(
      `<sheet name="${safeSheetName}" sheetId="${sheetId}" r:id="${rId}"/>`,
    );
    workbookRelsTags.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetId}.xml"/>`,
    );
    contentTypesOverrides.push(
      `<Override PartName="/xl/worksheets/sheet${sheetId}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    );

    let colsXml = "";
    if (sheetDef.colWidths && sheetDef.colWidths.length > 0) {
      colsXml += "<cols>";
      sheetDef.colWidths.forEach((cw) => {
        const colNum = cw.colIdx + 1;
        colsXml += `<col min="${colNum}" max="${colNum}" width="${cw.width}" customWidth="1"/>`;
      });
      colsXml += "</cols>";
    }

    let sheetDataXml = "";

    if (sheetDef.rawRows && sheetDef.rawRows.length > 0) {
      const sortedRows = [...sheetDef.rawRows].sort((a, b) => a.rowNum - b.rowNum);
      sortedRows.forEach((r) => {
        sheetDataXml += `<row r="${r.rowNum}">`;
        const sortedCells = [...r.cells].sort((a, b) => a.colIdx - b.colIdx);
        sortedCells.forEach((c) => {
          const cellRef = `${getColLetter(c.colIdx)}${r.rowNum}`;
          const val = c.value;
          const styleAttr = typeof c.styleId === "number" ? ` s="${c.styleId}"` : "";

          if (val === null || val === undefined || val === "") {
            if (styleAttr) {
              sheetDataXml += `<c r="${cellRef}"${styleAttr}/>`;
            }
          } else if (typeof val === "number") {
            sheetDataXml += `<c r="${cellRef}"${styleAttr}><v>${val}</v></c>`;
          } else if (typeof val === "boolean") {
            sheetDataXml += `<c r="${cellRef}"${styleAttr} t="b"><v>${val ? 1 : 0}</v></c>`;
          } else {
            const text = escapeXml(val);
            sheetDataXml += `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t>${text}</t></is></c>`;
          }
        });
        sheetDataXml += "</row>";
      });
    } else {
      const headers = sheetDef.headers || [];
      const rows = sheetDef.rows || [];

      if (headers.length > 0) {
        sheetDataXml += `<row r="1" spans="1:${headers.length}">`;
        headers.forEach((h, colIdx) => {
          const cellRef = `${getColLetter(colIdx)}1`;
          sheetDataXml += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`;
        });
        sheetDataXml += "</row>";
      }

      rows.forEach((row, rowIdx) => {
        const rowNum = (headers.length > 0 ? 1 : 0) + rowIdx + 1;
        sheetDataXml += `<row r="${rowNum}" spans="1:${row.length}">`;
        row.forEach((val, colIdx) => {
          const cellRef = `${getColLetter(colIdx)}${rowNum}`;
          if (val === null || val === undefined) {
            sheetDataXml += `<c r="${cellRef}" s="3"/>`;
          } else if (typeof val === "number") {
            sheetDataXml += `<c r="${cellRef}" s="4"><v>${val}</v></c>`;
          } else if (typeof val === "boolean") {
            sheetDataXml += `<c r="${cellRef}" s="4" t="b"><v>${val ? 1 : 0}</v></c>`;
          } else {
            const text = escapeXml(val);
            sheetDataXml += `<c r="${cellRef}" s="3" t="inlineStr"><is><t>${text}</t></is></c>`;
          }
        });
        sheetDataXml += "</row>";
      });
    }

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  ${colsXml}
  <sheetData>
    ${sheetDataXml}
  </sheetData>
</worksheet>`;

    sheetEntries.push({
      sheetId,
      name: safeSheetName,
      xml: sheetXml,
    });
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${contentTypesOverrides.join("\n  ")}
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelsTags.join("\n  ")}
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${workbookSheetTags.join("\n    ")}
  </sheets>
</workbook>`;

  const zipFiles: ZipEntry[] = [
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: relsXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/styles.xml", data: generateStylesXml() },
  ];

  sheetEntries.forEach((s) => {
    zipFiles.push({
      name: `xl/worksheets/sheet${s.sheetId}.xml`,
      data: s.xml,
    });
  });

  return createZipArchive(zipFiles);
}

/**
 * Generates a valid Microsoft Excel (.xlsx) file Buffer from a single sheet name, headers, and rows.
 */
export function generateXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][],
): Buffer {
  return generateMultiSheetXlsxBuffer([
    {
      name: sheetName,
      headers,
      rows,
    },
  ]);
}

