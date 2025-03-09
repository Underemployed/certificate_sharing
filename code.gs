var eventName = "Gitflow 2.0";
var slideTemplateId = "YOUR_SLIDE_TEMPLATE_ID";
var sheetId = "YOUR_SPREADSHEET_ID";
var tempFolderId = "YOUR_TEMP_FOLDER_ID";
var SocietyName = "ISTE SC GECBH";

// Helper function to find column index case-insensitively
function getColumnIndex(headers, columnName) {
    return headers.findIndex(header => header.toLowerCase().trim() === columnName.toLowerCase().trim());
}

// Create required columns if missing
function setupSheet() {
    var sheet = SpreadsheetApp.openById(sheetId).getActiveSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Create missing columns
    var requiredColumns = ['Slide ID', 'Status'];
    requiredColumns.forEach(col => {
        if (!headers.some(h => h.toLowerCase() === col.toLowerCase())) {
            sheet.getRange(1, headers.length + 1).setValue(col);
            headers.push(col);
        }
    });

    return {
        sheet: sheet,
        headers: headers,
        nameIndex: getColumnIndex(headers, 'Name'),
        emailIndex: getColumnIndex(headers, 'Email'),
        institutionIndex: getColumnIndex(headers, 'College'), // Handles 'college' or 'College'
        dateIndex: getColumnIndex(headers, 'Date'),
        slideIndex: getColumnIndex(headers, 'Slide ID'),
        statusIndex: getColumnIndex(headers, 'Status')
    };
}

function createCertificates() {
    var setup = setupSheet();
    var sheet = setup.sheet;
    var headers = setup.headers;

    // Validate required columns
    if (setup.nameIndex === -1 || setup.emailIndex === -1 || setup.institutionIndex === -1) {
        throw new Error('Missing required columns: Name, Email, or College');
    }

    var template = DriveApp.getFileById(slideTemplateId);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
        var row = i + 1;
        var rowData = values[i];
        var currentStatus = rowData[setup.statusIndex] || '';

        // Skip processed rows
        if (['CREATED', 'SENT'].includes(currentStatus.toUpperCase())) continue;

        try {
            var name = rowData[setup.nameIndex];
            var institution = rowData[setup.institutionIndex];

            // Create certificate copy
            var tempFolder = DriveApp.getFolderById(tempFolderId);
            var slideCopy = template.makeCopy(tempFolder);
            slideCopy.setName(`${name} - ${eventName} Certificate`);
            var slideId = slideCopy.getId();

            // Update template text
            var presentation = SlidesApp.openById(slideId);
            presentation.getSlides().forEach(slide => {
                slide.replaceAllText("<Name>", name);
                slide.replaceAllText("<Institution>", institution);
            });

            // Update spreadsheet
            sheet.getRange(row, setup.slideIndex + 1).setValue(slideId);
            sheet.getRange(row, setup.statusIndex + 1).setValue("CREATED");

        } catch (error) {
            console.error(`Error row ${row}: ${error}`);
            sheet.getRange(row, setup.statusIndex + 1).setValue(`ERROR: ${error.message}`);
        }
        SpreadsheetApp.flush();
    }
}

function sendCertificates() {
    var setup = setupSheet();
    var sheet = setup.sheet;
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
        var row = i + 1;
        var rowData = values[i];
        var currentStatus = rowData[setup.statusIndex] || '';

        // Skip non-created and already sent certificates
        if (currentStatus.toUpperCase() !== 'CREATED') continue;

        try {
            var name = rowData[setup.nameIndex];
            var email = rowData[setup.emailIndex];
            var slideId = rowData[setup.slideIndex];

            // Validate required fields
            if (!email || !slideId) {
                sheet.getRange(row, setup.statusIndex + 1).setValue("ERROR: Missing email or slide ID");
                continue;
            }

            // Prepare email
            var pdfFile = DriveApp.getFileById(slideId).getAs(MimeType.PDF);
            var subject = `${name}, Your ${eventName} Certificate`;

            var body = `Dear ${name},\n\n` +
                `Thank you for participating in ${eventName} organized by ${SocietyName}!\n\n` +
                `Find your certificate attached. We appreciate your participation.\n\n` +
                `Best regards,\n${SocietyName}`;

            // Send email
            GmailApp.sendEmail(email, subject, body, {
                attachments: [pdfFile],
                name: SocietyName
            });

            // Update status
            sheet.getRange(row, setup.statusIndex + 1).setValue("SENT");

        } catch (error) {
            console.error(`Error sending to ${email}: ${error}`);
            sheet.getRange(row, setup.statusIndex + 1).setValue(`ERROR: ${error.message}`);
        }
        SpreadsheetApp.flush();
    }
}