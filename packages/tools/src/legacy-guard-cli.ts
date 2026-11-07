import { checkLegacy, createGit } from './legacy-guard';

const problems = checkLegacy(createGit(process.cwd()));

if (problems.length > 0) {
  console.error(`Legacy guard failed.\n${problems.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Legacy guard passed: legacy/ matches v0-2019.');
}
