# 6. สร้างไฟล์ตรวจสอบ HTML (ถ้าต้องการ)
Write-Host "📄 Creating test HTML file..." -ForegroundColor Green

$testHtmlContent = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>jQuery & ContentScript Test</title>
</head>
<body>
    <h1>Test Page</h1>
    <button id="testBtn">Test record() function</button>
    
    <!-- jQuery must be loaded FIRST -->
    <script src="src/toggle/jquery.js"></script>
    
    <!-- Then contentScript -->
    <script src="contentScript.js"></script>
    
    <!-- Test script -->
    <script>
        $(document).ready(function() {
            console.log('✅ jQuery loaded:', $.fn.jquery);
            
            $('#testBtn').click(function() {
                // Test with valid data
                record({ sentence: 'Test sentence' });
                
                // Test with invalid data
                record(null);
                record({ noSentence: 'test' });
            });
        });
    </script>
</body>
</html>
'@

Set-Content -Path "test-contentscript.html" -Value $testHtmlContent -Encoding UTF8