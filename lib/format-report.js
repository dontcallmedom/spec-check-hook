function formatReport(removedTargets, url) {
  const targets = [...new Set(removedTargets.map(t => t.links).flat())];

  return `<details><summary>The changes in this pull request remove ${targets.length} anchors that ${removedTargets.length} specs link to.</summary>
<ul>
${targets.map(anchor =>
  `<li><a href="${url}#${anchor}">${anchor}</a> linked by by ${removedTargets.filter(t => t.links.includes(anchor)).map(({spec}) => `<a href='${spec.url}'>${spec.title}</a>`).join(', ')}</li>`
)}
</ul>
</details>`;
};

module.exports = { formatReport } ;
