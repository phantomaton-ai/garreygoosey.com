import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const datesFile = 'comics/dates.yaml';
const comicsDir = 'comics';
const builtDir = 'built';
const styleFileName = 'style.css'; // Filename for the CSS file in built

const styleContent = `
:root {
    --color-beige: #F5F5DC; /* A classic beige */
    --color-brown: #A0522D; /* A reddish-brown */
    --color-dark-brown: #5A2D1A; /* A darker brown for text */
    --color-light-brown: #CD853F; /* A lighter brown for links */
}

body {
    font-family: sans-serif; /* Simple font for simple minds */
    line-height: 1.6;
    margin: 0;
    padding: 20px;
    background-color: var(--color-beige);
    color: var(--color-dark-brown); /* Default text color */
}

header {
    text-align: center;
    margin-bottom: 30px;
}

h1 {
    color: var(--color-brown);
    font-size: 2.5em;
    margin: 0;
}

main {
    max-width: 800px; /* Keep content contained */
    margin: 0 auto; /* Center the content */
    padding: 20px;
    background-color: rgba(255, 255, 255, 0.7); /* Slightly transparent white background for main content */
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}

.comic-container {
    margin-bottom: 30px;
    border: 2px solid var(--color-brown);
    padding: 10px;
    background-color: var(--color-beige); /* Nested beige inside main */
}

.comic-panels {
    display: flex; /* Arrange panels side-by-side */
    gap: 10px; /* Space between panels */
    justify-content: center; /* Center the panels if they don't fill the width */
    flex-wrap: wrap; /* Allow panels to wrap on smaller screens */
}

.panel {
    flex: 1; /* Allow panels to grow/shrink */
    min-width: 200px; /* Minimum width before wrapping */
    display: flex;
    flex-direction: column;
    align-items: center; /* Center image and caption */
    text-align: center;
}

.panel img {
    max-width: 95%; /* Make images slightly smaller than their container */
    height: auto;
    border: 1px solid var(--color-light-brown); /* Subtle border around images */
    margin-bottom: 10px;
}

.caption {
    font-style: italic; /* As per garreygoosey.md */
    margin: 0;
    padding: 0 5px; /* Add some padding */
    color: var(--color-dark-brown);
}

.date {
    text-align: right;
    font-size: 0.9em;
    color: var(--color-dark-brown);
    margin-top: 15px;
}

.comic-navigation {
    display: flex;
    justify-content: space-between; /* Put Previous and Next on opposite ends */
    margin-bottom: 20px;
}

.comic-navigation a,
.comic-navigation span {
    padding: 10px 15px;
    border: 1px solid var(--color-brown);
    border-radius: 5px;
    text-decoration: none;
    color: var(--color-dark-brown);
    background-color: var(--color-light-brown);
    transition: background-color 0.3s ease;
}

.comic-navigation a:hover {
    background-color: var(--color-brown);
    color: var(--color-beige);
}

.comic-navigation span.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: #ccc; /* A neutral grey for disabled */
    border-color: #bbb;
}

.comic-calendar details {
    border: 1px solid var(--color-brown);
    padding: 10px;
    border-radius: 5px;
    background-color: var(--color-light-brown);
}

.comic-calendar summary {
    font-weight: bold;
    cursor: pointer;
    color: var(--color-dark-brown);
}

.comic-calendar ul {
    list-style: none;
    padding: 0;
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap; /* Allow dates to wrap */
    gap: 5px; /* Space between date links */
}

.comic-calendar li {
    display: inline; /* Display list items inline */
}

.comic-calendar a {
    text-decoration: none;
    color: var(--color-dark-brown);
    padding: 2px 5px;
    border-radius: 3px;
    transition: background-color 0.2s ease;
}

.comic-calendar a:hover {
    background-color: var(--color-beige);
}


/* Basic Mobile Adjustments */
@media (max-width: 600px) {
    body {
        padding: 10px;
    }

    h1 {
        font-size: 2em;
    }

    .comic-panels {
        flex-direction: column; /* Stack panels vertically on small screens */
        gap: 20px; /* More space when stacked */
    }

    .panel {
        min-width: auto; /* Remove min-width constraint */
        width: 100%; /* Take full width */
    }

    .panel img {
         max-width: 100%; /* Allow full width usage if needed */
    }

    .comic-navigation {
        flex-direction: column; /* Stack nav buttons */
        gap: 10px;
    }

     .comic-navigation a,
     .comic-navigation span {
        text-align: center; /* Center the text in buttons */
     }

     .comic-calendar ul {
        flex-direction: column; /* Stack date links too */
     }
}
`;


async function readComic(comicDir) {
  const mdFile = path.join(comicDir, `${path.basename(comicDir)}.md`);
  let mdContent;
  try {
    mdContent = await fs.readFile(mdFile, 'utf8');
  } catch (e) {
    console.error(`Error reading comic markdown file: ${mdFile}`, e);
    throw e; // Re-throw to halt processing for this comic
  }

  // Split by lines, trim whitespace, remove empty lines
  const nonEmptyLines = mdContent.split('\n')
                                 .map(line => line.trim())
                                 .filter(line => line !== '');

  const panels = [];
  // Process lines in pairs: caption followed by image markdown
  for (let i = 0; i < nonEmptyLines.length; i += 2) {
    const caption = nonEmptyLines[i];
    const imageMarkdown = nonEmptyLines[i + 1]; // Assumes pairs exist

    if (!caption || !imageMarkdown) {
       console.warn(`Unexpected format in ${mdFile}. Expected caption then image markdown, found incomplete pair starting with: "${caption}".`);
       // Decide how to handle incomplete pairs - for now, skip or add partial? Let's skip.
       break;
    }

    const match = imageMarkdown.match(/\!\[.*?\]\((.*?)\)/);
    if (match && match[1]) {
      const imagePath = match[1]; // This is the filename like 'dining-1.png'
      panels.push({ caption, imagePath });
    } else {
      console.warn(`Could not parse image path from markdown line: "${imageMarkdown}" in ${mdFile}`);
       // Add panel with caption but null image if parsing fails? Let's add the caption only.
       panels.push({ caption, imagePath: null });
    }
  }
  return { panels };
}

function generateComicHtml(currentDate, comicData, nav, allDates, datesMap) {
    // Path adjustment: Images are in ../comics/comic-name/ from built/date.html
    const comicDirName = datesMap[currentDate];
    const imagePrefix = `../comics/${comicDirName}/`;

    // Generate calendar list
    const archiveListItems = allDates.map(date =>
        `<li><a href="${date}.html">${date}</a></li>`
    ).join('');

    // Basic HTML structure
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Garrey Goosey - ${currentDate}</title>
    <link rel="stylesheet" href="${styleFileName}">
</head>
<body class="beige-brown">
    <header>
        <h1>Garrey Goosey comics</h1>
    </header>
    <main>
        <section class="comic-container">
            <div class="comic-panels">
                ${comicData.panels.map((panel, index) => `
                <div class="panel">
                    ${panel.imagePath ? `<img src="${imagePrefix}${panel.imagePath}" alt="Panel ${index + 1}">` : '<p>Image missing</p>'}
                    <p class="caption">${panel.caption}</p>
                </div>
                `).join('')}
            </div>
            <p class="date">${currentDate}</p>
        </section>
        <nav class="comic-navigation">
            ${nav.prevDate ? `<a href="${nav.prevDate}.html">Previous</a>` : `<span class="disabled">Previous</span>`}
            ${nav.nextDate ? `<a href="${nav.nextDate}.html">Next</a>` : `<span class="disabled">Next</span>`}
        </nav>
        <details class="comic-calendar">
            <summary>Archive</summary>
            <ul>
                ${archiveListItems}
            </ul>
        </details>
    </main>
</body>
</html>`;

    return html;
}


async function build() {
  try {
    // Read the dates YAML
    const datesYaml = await fs.readFile(datesFile, 'utf8');
    const dates = yaml.load(datesYaml);
    const sortedDates = Object.keys(dates).sort(); // Get dates in chronological order

    console.log('Dates loaded:', dates);
    console.log('Sorted dates:', sortedDates);

    // Ensure built directory exists
    await fs.mkdir(builtDir, { recursive: true });
    console.log(`Ensured ${builtDir} exists.`);

    // Write the main stylesheet *after* builtDir is ensured
    await fs.writeFile(path.join(builtDir, styleFileName), styleContent, 'utf8');
    console.log(`Wrote ${styleFileName} to ${builtDir}.`);


    // Process each comic according to the dates
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const comicName = dates[date];
      const comicDir = path.join(comicsDir, comicName);

      try {
        // Read the comic data
        const comicData = await readComic(comicDir);
        console.log(`Read comic data for ${comicName} (${date})`); // Log less detail here

        // Get navigation dates
        const prevDate = i > 0 ? sortedDates[i - 1] : null;
        const nextDate = i < sortedDates.length - 1 ? sortedDates[i + 1] : null;

        // Generate HTML content for this comic date
        const htmlContent = generateComicHtml(date, comicData, { prevDate, nextDate }, sortedDates, dates);

        // Write HTML to builtDir/${date}.html
        await fs.writeFile(path.join(builtDir, `${date}.html`), htmlContent, 'utf8');
        console.log(`Generated and wrote built/${date}.html`);

        // TODO: Copy image files for this comic to built/comics/comicName/

      } catch (e) {
        console.error(`Error processing comic ${comicName} for date ${date}:`, e);
        // Continue to the next comic even if one fails? Yes, for robustness.
      }
    }

    // Generate index.html pointing to the latest comic
    const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : 'NO_COMICS'; // Handle no comics case
    const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="0; URL=/${latestDate}.html" />
    <title>Garrey Goosey Comics</title>
</head>
<body>
    <p>Redirecting to the latest comic... <a href="/${latestDate}.html">Click here if you are not redirected</a>.</p>
</body>
</html>`;
    await fs.writeFile(path.join(builtDir, 'index.html'), indexHtmlContent, 'utf8');
    console.log(`Generated index.html redirect to ${latestDate}.html`);

  } catch (e) {
    console.error('Build process failed:', e);
  }
}

build();