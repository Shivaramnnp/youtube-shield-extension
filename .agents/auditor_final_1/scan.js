
const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if (file === "node_modules" || file === ".git" || file === ".agents" || file === "dist") return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith(".js") && !fullPath.includes("scratch/")) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk("/Users/shivarampatel/Desktop/shorts-shield");
console.log("Auditing " + files.length + " production and test JS files for static integrity anomalies...");

const suspiciousPatterns = [
  { name: "Dummy return literal only", regex: /function\s+\w+\([^)]*\)\s*\{\s*return\s+(true|false|null|undefined|0|1|""|);?\s*\}/g },
  { name: "Bypassed assertion or always true assert", regex: /assert\s*\(\s*true\s*[,)]/g },
  { name: "Hardcoded fake return string", regex: /return\s+["'](PASS|TEST_PASSED|OK|SUCCESS)["']/g }
];

const findings = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative("/Users/shivarampatel/Desktop/shorts-shield", file);
  
  for (const pat of suspiciousPatterns) {
    let match;
    while ((match = pat.regex.exec(content)) !== null) {
      findings.push({ file: rel, pattern: pat.name, match: match[0], index: match.index });
    }
  }
}

console.log("Scan completed. Total matches flagged: " + findings.length);
console.log(JSON.stringify(findings, null, 2));
