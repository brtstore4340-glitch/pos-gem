$root = "excel-status-extension"
$zipName = "excel-status-extension.zip"

# Clean old files
if (Test-Path $root) { Remove-Item $root -Recurse -Force }
if (Test-Path $zipName) { Remove-Item $zipName -Force }

# Create folder
New-Item -ItemType Directory -Path $root | Out-Null

# ---------- manifest.json ----------
@'
{
  "manifest_version": 3,
  "name": "Excel Status Separator",
  "version": "1.2",
  "action": {
    "default_popup": "popup.html",
    "default_title": "Separate Excel Files"
  },
  "permissions": []
}
'@ | Set-Content "$root\manifest.json" -Encoding UTF8

# ---------- popup.html ----------
@'
<!DOCTYPE html>
<html>
<head>
  <title>Excel Status Separator</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h2>Upload Excel Files</h2>
  <input type="file" id="excelFiles" accept=".xlsx,.xls" multiple />
  <p id="status"></p>
  <script src="xlsx.full.min.js"></script>
  <script src="popup.js"></script>
</body>
</html>
'@ | Set-Content "$root\popup.html" -Encoding UTF8

# ---------- popup.js ----------
@'
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
'@ | Set-Content "$root\popup.js" -Encoding UTF8

# ---------- style.css ----------
@'
body {
  font-family: Arial, sans-serif;
  padding: 10px;
  width: 280px;
}

input[type="file"] {
  margin-top: 10px;
}

#status {
  margin-top: 15px;
  font-size: 14px;
  color: green;
}
'@ | Set-Content "$root\style.css" -Encoding UTF8

# ---------- Download SheetJS ----------
Invoke-WebRequest `
  -Uri "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js" `
  -OutFile "$root\xlsx.full.min.js"

# ---------- Create ZIP ----------
Compress-Archive -Path "$root\*" -DestinationPath $zipName

Write-Host "DONE! Created $zipName" -ForegroundColor Green