'use babel';

export function toolEnv() {
  return Object.assign(
    {},
    process.env,
    {PATH: atom.config.get('casefile.toolPath')}
  );
}
