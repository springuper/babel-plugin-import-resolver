const regCache = {};
const getReg = (str) => {
  if (!regCache[str]) {
    regCache[str] = new RegExp(str);
  }
  return regCache[str];
};
const regTplVariable = /\{([^}]+)\}/g;
const genContent = (tpl, data) => (
  tpl.replace(regTplVariable, (match, variable) => data[variable] || '')
);

function transformImportResolve({ types: t }) {
  function resolver(
    path,
    {
      file: { opts: { filename } },
      opts: { rules },
    }
  ) {
    const { node } = path;
    // path maybe removed by prev instances
    if (!node) return;

    const source = node.source.value;
    const specificImports = [];
    node.specifiers.forEach((spec) => {
      if (!t.isImportSpecifier(spec)) return;

      const optRules = Array.isArray(rules) ? rules : [rules];
      let template;
      optRules.some((rule) => {
        if (!source.match(getReg(rule.condition))) return false;
        template = rule.template;
        return true;
      });
      if (!template) return;

      const location = genContent(template, {
        name: spec.imported.name,
        source,
        filename,
      });
      if (location && location !== source) {
        const declaration = t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(spec.local.name))],
          t.stringLiteral(location));
        specificImports.push(declaration);
      }
    });

    if (specificImports.length) {
      path.replaceWithMultiple(specificImports);
    }
  }

  const importVisitors = {
    ImportDeclaration: resolver,
  };

  return {
    visitor: {
      Program: {
        enter(programPath, state) {
          programPath.traverse(importVisitors, state);
        },
      },
    },
  };
}

module.exports = transformImportResolve;
