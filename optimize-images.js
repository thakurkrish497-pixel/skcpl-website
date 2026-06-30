const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace <img (but ignore if it already has loading="lazy" or is the first/hero image if possible. We will just add to all that don't have it)
  // And replace the tailwind cdn script with the link to our compiled css
  content = content.replace(/<script src="https:\/\/cdn\.tailwindcss\.com\?plugins=forms,container-queries"><\/script>/g, '<link rel="stylesheet" href="./public/tailwind.css">');
  
  // Also remove the <script> tailwind.config = ... </script> block since we compiled it
  content = content.replace(/<script>\s*tailwind\.config = {[\s\S]*?<\/script>/g, '');

  content = content.replace(/<img (?![^>]*loading="lazy")/gi, '<img loading="lazy" decoding="async" ');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Optimized ${file}`);
});
