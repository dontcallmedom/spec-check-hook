const { targetify } = require("./util");

function formatReport(removedTargets, spec) {
  const targets = [...new Set(removedTargets.map(t => t.links).flat())];

  return `<details data-sc-marker="removedtargets"><summary>The changes in this pull request remove ${targets.length} anchors that ${removedTargets.length} specs link to.</summary>
<ul>
${targets.map(link =>
  `<li><a href="${link}">${targetify(spec)(link)}</a> linked by ${removedTargets.filter(t => t.links.includes(link)).map(({spec: s}) => `<a href='${s.url}'>${s.title}</a>`).join(', ')}</li>`
)}
</ul>
</details>`;
};

module.exports = { formatReport } ;
