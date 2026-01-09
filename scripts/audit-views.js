const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const routesDir = path.join(rootDir, 'app/routes');
const controllersDir = path.join(rootDir, 'app/controllers');
const viewsDir = path.join(rootDir, 'views');

function getFiles(dir, allFiles) {
    if (!fs.existsSync(dir)) return allFiles || [];
    const files = fs.readdirSync(dir);
    allFiles = allFiles || [];
    files.forEach(function (file) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, allFiles);
        } else if (file.endsWith('.js')) {
            allFiles.push(name);
        }
    });
    return allFiles;
}

function findMissingViews() {
    const files = getFiles(routesDir).concat(getFiles(controllersDir));

    const missingViews = [];
    const foundViews = new Set();

    files.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const regex = /res\.render\(['"]([^'"]+)['"]/g;
            let match;

            while ((match = regex.exec(content)) !== null) {
                const viewPath = match[1];
                const fullViewPath = path.join(viewsDir, viewPath + '.ejs');

                if (!fs.existsSync(fullViewPath)) {
                    missingViews.push({
                        file: path.relative(rootDir, file),
                        view: viewPath
                    });
                } else {
                    foundViews.add(viewPath);
                }
            }
        } catch (e) {
            console.error(`Error reading ${file}: ${e.message}`);
        }
    });

    console.log('\n--- Missing EJS Views Audit ---');
    if (missingViews.length === 0) {
        console.log('✅ No missing views found!');
    } else {
        const uniqueMissing = [...new Set(missingViews.map(m => m.view))];
        console.log(`❌ Found ${uniqueMissing.length} unique missing views:\n`);
        uniqueMissing.sort().forEach(view => {
            const referencedIn = missingViews.filter(m => m.view === view).map(m => m.file);
            console.log(`- ${view}`);
            console.log(`  (Referenced in: ${[...new Set(referencedIn)].join(', ')})`);
        });
    }
    console.log('\n-----------------------------\n');
}

findMissingViews();
