const baseDirUrl = url => url.replace(/\/[^\/]*$/, '/');
const targetify = spec => url => {
  if (spec.nightly.pages?.length) {
    return url.replace(baseDirUrl(url), '');
  } else {
    return "#" + url.split("#")[1];
  }
};


module.exports = { baseDirUrl, targetify };
