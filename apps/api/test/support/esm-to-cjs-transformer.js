// Jest transformer for the few dependencies that ship ESM only
// (@nestjs/jwt 12 and @nestjs/passport 12). Node can require() them natively,
// Jest's module runtime cannot, so they are transpiled to CommonJS here.
const ts = require('typescript');

module.exports = {
  process(sourceText, sourcePath) {
    const out = ts.transpileModule(sourceText, {
      fileName: sourcePath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        allowJs: true,
      },
    });
    return { code: out.outputText };
  },
};
