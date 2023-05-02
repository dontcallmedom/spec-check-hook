const { targetify } = require("util");

function formatReport(removedTargets, url) {
  const targets = [...new Set(removedTargets.map(t => t.links).flat())];

  return `<details><summary>The changes in this pull request remove ${targets.length} anchors that ${removedTargets.length} specs link to.</summary>
<ul>
${targets.map(link =>
  `<li><a href="${link}">${targetify(link)}</a> linked by by ${removedTargets.filter(t => t.links.includes(link)).map(({spec}) => `<a href='${spec.url}'>${spec.title}</a>`).join(', ')}</li>`
)}
</ul>
</details>`;
};

module.exports = { formatReport } ;
