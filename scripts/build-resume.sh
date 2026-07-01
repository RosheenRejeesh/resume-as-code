#!/bin/bash
set -e

echo "Validate required environment variables"
if [ -z "$FILE_PATH" ] ; then
    echo "Error: Required environment variables not set"
    echo "Required: FILE_PATH"
    exit 1
fi

echo "Building resume..."

echo "Install dependencies"
npm ci
npx playwright install chromium

echo "Generate HTML"
npm run export-html

echo "Prepare HTML for PDF export"
sed -i 's/margin: 10mm 25mm;/margin: 5mm 5mm;/g' $FILE_PATH/index.html

echo "Generate PDF"
npm run export-pdf $FILE_PATH

echo "Add links and embed PDF"
echo '<a href="./resume.pdf" target="_blank"><p>Download PDF</p></a>' >> $FILE_PATH/index.html
echo '<embed src="./resume.pdf" type="application/pdf" width="100%" height="100%" />' >> $FILE_PATH/resume.html

echo "Resume build completed successfully!"

echo "artifact_name=$(basename $FILE_PATH)" >> $GITHUB_OUTPUT