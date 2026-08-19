function createClassNameSlug(hash, title, args) {
  let titleToUse;
  if (title === "className") {
    /* this is the case when the result of a `css` function call is directly assigned to a `className` JSX prop */
    titleToUse = "INLINE";
  } else {
    titleToUse = title;
  }
  return process.env.NODE_ENV === "production"
    ? hash
    : `${args.file.substring(0, args.file.length - args.ext.length)}_${titleToUse}_${hash}`;
}

module.exports = { createClassNameSlug };
