// Print functionality for flashcards

/**
 * Print double-sided cards (both fronts and backs)
 * @param {Array} cards - The flashcards to print
 * @param {string} title - Optional title for the print
 */
export const printDoubleSidedCards = (cards, title = 'Flashcards') => {
  const printContainer = document.createElement("div");
  printContainer.id = "print-container";

  // Create one page per card
  cards.forEach((card, index) => {
    // Create front page
    const frontPage = document.createElement("div");
    frontPage.className = "print-page";
    frontPage.innerHTML = `
      <div class="print-card">
        <div class="print-card-content">
          ${card.front || card.question || ''}
        </div>
      </div>
    `;

    // Create back page
    const backPage = document.createElement("div");
    backPage.className = "print-page";
    backPage.innerHTML = `
      <div class="print-card">
        <div class="print-card-content">
          ${card.back || ''}
        </div>
      </div>
    `;

    printContainer.appendChild(frontPage);
    printContainer.appendChild(backPage);
  });

  // Open print window
  const printWindow = window.open("", "PrintDoubleSided", "width=1200,height=800");
  printWindow.document.write(`
    <html>
    <head>
      <title>Print Flashcards</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .print-page {
          page-break-after: always;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 99vh;
          width: 100%;
          box-sizing: border-box;
          padding: 0.25in;
        }
        .print-card {
          border: 1px solid #ccc;
          border-radius: 0.15in;
          width: 5in;
          height: 3in;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.25in;
          box-sizing: border-box;
          background-color: white;
        }
        .print-card-content {
          width: 100%;
          text-align: center;
          font-size: 12pt;
        }
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            margin: 0;
          }
          .print-page {
            margin: 0;
            border: initial;
            border-radius: initial;
            width: initial;
            min-height: initial;
            box-shadow: initial;
            background: initial;
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      ${printContainer.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

/**
 * Print only the fronts of cards
 * @param {Array} cards - The flashcards to print
 * @param {string} title - Optional title for the print
 */
export const printCardFronts = (cards, title = 'Flashcards') => {
  const printContainer = document.createElement("div");
  printContainer.id = "print-container-fronts";

  // Create one page per card
  cards.forEach((card, index) => {
    // Create front page
    const frontPage = document.createElement("div");
    frontPage.className = "print-page";
    frontPage.innerHTML = `
      <div class="print-card">
        <div class="print-card-content">
          ${card.front || card.question || ''}
        </div>
      </div>
    `;

    printContainer.appendChild(frontPage);
  });

  // Open print window
  const printWindow = window.open("", "PrintFronts", "width=1200,height=800");
  printWindow.document.write(`
    <html>
    <head>
      <title>Print Card Fronts</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .print-page {
          page-break-after: always;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 99vh;
          width: 100%;
          box-sizing: border-box;
          padding: 0.25in;
        }
        .print-card {
          border: 1px solid #ccc;
          border-radius: 0.15in;
          width: 5in;
          height: 3in;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.25in;
          box-sizing: border-box;
          background-color: white;
        }
        .print-card-content {
          width: 100%;
          text-align: center;
          font-size: 12pt;
        }
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            margin: 0;
          }
          .print-page {
            margin: 0;
            border: initial;
            border-radius: initial;
            width: initial;
            min-height: initial;
            box-shadow: initial;
            background: initial;
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      ${printContainer.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

/**
 * Print only the backs of cards
 * @param {Array} cards - The flashcards to print
 * @param {string} title - Optional title for the print
 */
export const printCardBacks = (cards, title = 'Flashcards') => {
  const printContainer = document.createElement("div");
  printContainer.id = "print-container-backs";

  // Create one page per card
  cards.forEach((card, index) => {
    // Create back page
    const backPage = document.createElement("div");
    backPage.className = "print-page back";
    backPage.innerHTML = `
      <div class="print-card">
        <div class="print-card-content">
          ${card.back || ''}
        </div>
      </div>
    `;

    printContainer.appendChild(backPage);
  });

  // Open print window
  const printWindow = window.open("", "PrintBacks", "width=1200,height=800");
  printWindow.document.write(`
    <html>
    <head>
      <title>Print Card Backs</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
        }
        .print-page {
          page-break-after: always;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 99vh;
          width: 100%;
          box-sizing: border-box;
          padding: 0.25in;
        }
        .print-page.back {
          background-color: #f9f9f9;
        }
        .print-card {
          border: 1px solid #ccc;
          border-radius: 0.15in;
          width: 5in;
          height: 3in;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0.25in;
          box-sizing: border-box;
          background-color: white;
        }
        .print-card-content {
          width: 100%;
          text-align: center;
          font-size: 12pt;
        }
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            margin: 0;
          }
          .print-page {
            margin: 0;
            border: initial;
            border-radius: initial;
            width: initial;
            min-height: initial;
            box-shadow: initial;
            background: initial;
            page-break-after: always;
          }
        }
      </style>
    </head>
    <body>
      ${printContainer.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}; 