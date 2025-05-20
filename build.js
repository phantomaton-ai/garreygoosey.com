import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const datesFile = 'comics/dates.yaml';
const comicsDir = 'comics';
const builtDir = 'built';

async function build() {
  try {
    // Read the dates YAML
    const datesYaml = await fs.readFile(datesFile, 'utf8');
    const dates = yaml.load(datesYaml);
    console.log('Dates loaded:', dates);

    // Ensure built directory exists
    await fs.mkdir(builtDir, { recursive: true });
    console.log(`Ensured ${builtDir} exists.`);

    // For now, just confirm we can access comic directories
    for (const date in dates) {
      const comicName = dates[date];
      const comicPath = path.join(comicsDir, comicName);
      try {
        await fs.access(comicPath);
        console.log(`Found comic directory: ${comicPath}`);
      } catch (e) {
        console.error(`Comic directory not found: ${comicPath}`, e);
      }
    }

  } catch (e) {
    console.error('Build failed:', e);
  }
}

build();