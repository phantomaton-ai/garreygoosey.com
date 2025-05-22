import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const datesFile = 'comics/dates.yaml';
const comicsDir = 'comics';
const builtDir = 'built';
const builtComicsDir = path.join(builtDir, comicsDir); // Target directory for comic images
const styleFileName = 'style.css'; // Filename for the CSS file in built
const styleSourcePath = styleFileName; // Path to the source CSS file in the root

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

  if (nonEmptyLines.length === 0) {
      console.warn(`Comic markdown file is empty: ${mdFile}`);
      return { title: '', panels: [] };
  }

  // The first line is the title (assuming it starts with #)
  const titleLine = nonEmptyLines[0];
  const title = titleLine.startsWith('#') ? titleLine.substring(1).trim() : titleLine.trim();

  const panels = [];
  // Process remaining lines in pairs: image markdown followed by caption
  // Start from the second line (index 1) and process in steps of 2
  const panelLines = nonEmptyLines.slice(1);
  // Loop up to the second-to-last line to ensure pair (index i and i+1)
  for (let i = 0; i < panelLines.length - 1; i += 2) {
    const imageMarkdown = panelLines[i]; // Corrected order based on user feedback
    const caption = panelLines[i + 1];   // Corrected order based on user feedback
    const captionType = caption.startsWith('"') && caption.endsWith('"') ? 'quote' : 'narration';

    const match = imageMarkdown.match(/\!\[.*?\]\((.*?)\)/);
    if (match && match[1]) {
      const imagePath = match[1]; // This is the filename like 'dining-1.png'
      panels.push({ caption, captionType, imagePath });
    } else {
      console.warn(`Could not parse image path from markdown line: "${imageMarkdown}" in ${mdFile}. Associated caption: "${caption}"`);
      // Add panel with caption but null image if parsing fails? Yes, safer than skipping the caption.
      panels.push({ caption, imagePath: null });
    }
  }

   // Check for leftover lines that didn't form a pair (e.g., a final caption or image markdown)
   if (panelLines.length % 2 !== 0) {
       const leftoverLine = panelLines[panelLines.length - 1];
       console.warn(`Found a leftover line in ${mdFile} that did not form an image/caption pair: "${leftoverLine}"`);
       // Decide how to handle this - for now, we'll just warn and ignore.
   }


  return { title, panels };
}

async function copyComicImages(srcDir, destDir) {
    try {
        await fs.mkdir(destDir, { recursive: true }); // Ensure target comic directory exists
        const files = await fs.readdir(srcDir);
        for (const file of files) {
            // Only copy image files (based on common extensions)
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file).toLowerCase())) {
                const srcPath = path.join(srcDir, file);
                const destPath = path.join(destDir, file);
                await fs.copyFile(srcPath, destPath);
                // console.log(`Copied image: ${file}`); // Less logging during loop
            }
        }
        console.log(`Finished copying images from ${srcDir} to ${destDir}.`); // Log completion
    } catch (e) {
        console.error(`Error copying images from ${srcDir} to ${destDir}:`, e);
        throw e; // Re-throw to potentially halt build for this comic
    }
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
            ${comicData.title ? `<h2 class="comic-title">${comicData.title}</h2>` : ''} <!-- Add Comic Title Here -->
            <div class="comic-panels">
                ${comicData.panels.map((panel, index) => `
                <div class="panel">
                    ${panel.imagePath ? `<img src="${imagePrefix}${panel.imagePath}" alt="${panel.caption}">` : '<p>Image missing</p>'}
                    <p class="caption ${panel.captionType}">${panel.caption}</p>
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
    <footer>
        <p>CC0 by <a href="https://phantomaton.com/" target="_blank">Phantomaton</a> | <a href="https://creativecommons.org/public-domain/cc0/" target="_blank">CC0 1.0 Universal (CC0 1.0) Public Domain Dedication</a></p>
    </footer>
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
     // Ensure built comics directory exists
    await fs.mkdir(builtComicsDir, { recursive: true });
    console.log(`Ensured ${builtComicsDir} exists.`);


    // Copy the main stylesheet from root to built
    await fs.copyFile(styleSourcePath, path.join(builtDir, styleFileName));
    console.log(`Copied ${styleSourcePath} to ${builtDir}/${styleFileName}.`);


    // Process each comic according to the dates
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const comicName = dates[date];
      const comicSrcDir = path.join(comicsDir, comicName);
      const comicDestDir = path.join(builtComicsDir, comicName); // Target directory for this comic's images

      try {
        // Copy image files for this comic
        await copyComicImages(comicSrcDir, comicDestDir);
        // console.log(`Copied images for ${comicName} to ${comicDestDir}`); // Moved logging into copyComicImages

        // Read the comic data (markdown)
        const comicData = await readComic(comicSrcDir);
        console.log(`Read comic data for ${comicName} (${date})`);
        console.log(`Comic Title: "${comicData.title}"`); // Log the extracted title

        // Get navigation dates
        const prevDate = i > 0 ? sortedDates[i - 1] : null;
        const nextDate = i < sortedDates.length - 1 ? sortedDates[i + 1] : null;

        // Generate HTML content for this comic date
        const htmlContent = generateComicHtml(date, comicData, { prevDate, nextDate }, sortedDates, dates);

        // Write HTML to builtDir/${date}.html
        await fs.writeFile(path.join(builtDir, `${date}.html`), htmlContent, 'utf8');
        console.log(`Generated and wrote built/${date}.html`);


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
    <link rel="stylesheet" href="${styleFileName}"> <!-- Link stylesheet for index too -->
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: var(--color-beige);
        color: var(--color-dark-brown);
        font-family: 'Chocolate Classical Sans', sans-serif; /* Use the main font */
        padding: 20px; /* Ensure padding is still applied */
        text-align: center; /* Center redirect text */
      }
      p { margin: 0; } /* Remove default paragraph margin */
      a { color: var(--color-dark-brown); text-decoration: underline; } /* Style link */
      a:hover { color: var(--color-brown); } /* Hover effect */
    </style>
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