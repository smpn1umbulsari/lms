// Pure OOXML Style & Border Injector via SheetJS CFB (tanpa dependensi DOM)

export const STYLE_IDS = {
  DEFAULT: 0,
  HEADER: 1,
  DATA_LEFT: 2,
  DATA_TEXT: 3,
  BAND_LEFT: 4,
  BAND_TEXT: 5,
  DATA_CENTER: 6,
  BAND_CENTER: 7,
  BLANK_BORDER: 8,
  BLANK_TEXT_BORDER: 9
};

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><color rgb="FF14161A"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F6B5C"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4F9F7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function colLettersToIndex(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n - 1;
}

function pickStyle(rIdx, cIdx, dataLen, spec) {
  if (rIdx === 0) return STYLE_IDS.HEADER;
  const isText = spec.textSet.has(cIdx);
  if (rIdx >= dataLen) {
    return isText ? STYLE_IDS.BLANK_TEXT_BORDER : STYLE_IDS.BLANK_BORDER;
  }
  const grp = Array.isArray(spec.rowGroups) ? spec.rowGroups[rIdx - 1] ?? rIdx - 1 : rIdx - 1;
  const banded = grp % 2 === 1;
  if (isText) return banded ? STYLE_IDS.BAND_TEXT : STYLE_IDS.DATA_TEXT;
  if (spec.centerSet.has(cIdx)) return banded ? STYLE_IDS.BAND_CENTER : STYLE_IDS.DATA_CENTER;
  return banded ? STYLE_IDS.BAND_LEFT : STYLE_IDS.DATA_LEFT;
}

function styleWorksheetXml(xml, spec) {
  let out = xml;
  if (spec.freezeHeader !== false) {
    const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>';
    out = out.includes("<sheetView workbookViewId=\"0\"/>")
      ? out.replace("<sheetView workbookViewId=\"0\"/>", `<sheetView workbookViewId="0">${pane}</sheetView>`)
      : out.replace("<sheetView workbookViewId=\"0\">", `<sheetView workbookViewId="0">${pane}`);
  }
  out = out.replace(/<row r="1">/, '<row r="1" ht="26" customHeight="1">');
  const dataLen = spec.aoa.length;
  return out.replace(/<c r="([A-Z]+)(\d+)"([^>]*?)(\/?)>/g, (m, col, rowStr, attrs, slash) => {
    const r = Number(rowStr) - 1;
    const c = colLettersToIndex(col);
    if (r < 0 || r >= spec.borderRows || c >= spec.ncols) return m;
    const sid = pickStyle(r, c, dataLen, spec);
    const cleaned = attrs.replace(/\s+s="\d+"/g, "");
    return `<c r="${col}${rowStr}" s="${sid}"${cleaned}${slash}>`;
  });
}

function prepareWorksheet(X, rawSpec) {
  const aoa = rawSpec.aoa || [[]];
  const ncols = Math.max(1, ...aoa.map((r) => r.length));
  const textSet = new Set(rawSpec.textCols || []);
  const centerSet = new Set(rawSpec.centerCols || []);
  const borderRows = Math.max(aoa.length, rawSpec.borderPadRows || aoa.length);
  const totalRows = Math.max(borderRows, rawSpec.padRows ? rawSpec.padRows + 1 : borderRows);

  const ws = X.utils.aoa_to_sheet(aoa);
  for (let r = 0; r < borderRows; r++) {
    for (let c = 0; c < ncols; c++) {
      const addr = X.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      if (textSet.has(c) && r > 0) ws[addr].z = "@";
    }
  }
  if (textSet.size && totalRows > borderRows) {
    for (let r = borderRows; r < totalRows; r++) {
      for (const c of textSet) {
        const addr = X.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "", z: "@" };
      }
    }
  }
  ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRows - 1, c: ncols - 1 } });
  ws["!cols"] = Array.from({ length: ncols }, (_, c) => ({
    wch: rawSpec.colWidths?.[c] || Math.min(54, Math.max(10, ...aoa.map((r) => String(r[c] ?? "").length)) + 3)
  }));
  if (rawSpec.merges?.length) ws["!merges"] = rawSpec.merges;
  return { ws, meta: { ...rawSpec, aoa, ncols, borderRows, textSet, centerSet } };
}

export function buildStyledWorkbookBytes(X, sheets) {
  const wb = X.utils.book_new();
  const metas = sheets.map((s) => {
    const { ws, meta } = prepareWorksheet(X, s);
    X.utils.book_append_sheet(wb, ws, s.name);
    return meta;
  });

  const rawBytes = new Uint8Array(X.write(wb, { type: "array", bookType: "xlsx" }));
  const zip = X.CFB.read(rawBytes, { type: "array" });
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stylesEntry = X.CFB.find(zip, "/xl/styles.xml");
  if (stylesEntry) {
    const bytes = enc.encode(STYLES_XML);
    stylesEntry.content = bytes;
    stylesEntry.size = bytes.length;
  }

  metas.forEach((meta, idx) => {
    const entry = X.CFB.find(zip, `/xl/worksheets/sheet${idx + 1}.xml`);
    if (!entry) return;
    const xml = styleWorksheetXml(dec.decode(Uint8Array.from(entry.content)), meta);
    const bytes = enc.encode(xml);
    entry.content = bytes;
    entry.size = bytes.length;
  });

  return new Uint8Array(X.CFB.write(zip, { type: "array", fileType: "zip", compression: true }));
}
