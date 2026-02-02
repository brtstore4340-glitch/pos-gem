/* global XLSX */
document.getElementById("excelFiles").addEventListener("change", handleFiles, false);

async function handleFiles(event) {
  const files = event.target.files;
  const status = document.getElementById("status");
  status.textContent = "";

  if (!files.length) {
    alert("Please select .xlsx or .xls files.");
    return;
  }

  for (let file of files) {
    if (!file.name.startsWith("PlannerNoStock_")) {
      continue;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, {
      type: "array",
      codepage: 65001
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const headers = rows.slice(0, 15);
    const body = rows.slice(15);

    const status0 = headers.concat(body.filter(r => r[8] === 0));
    const status5 = headers.concat(body.filter(r => r[8] === 5));
    const statusOther = headers.concat(body.filter(r => [1,2,3,4].includes(r[8])));

    const newWB = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWB, XLSX.utils.aoa_to_sheet(status0), "Status0");
    XLSX.utils.book_append_sheet(newWB, XLSX.utils.aoa_to_sheet(status5), "Status5");
    XLSX.utils.book_append_sheet(newWB, XLSX.utils.aoa_to_sheet(statusOther), "StatusOther");

    const newFileName = file.name.replace(/\.xlsx$|\.xls$/i, "_separated.xls");

    XLSX.writeFile(newWB, newFileName, {
      bookType: "xls",
      type: "binary"
    });
  }

  status.textContent = "All files processed and downloaded.";
}
