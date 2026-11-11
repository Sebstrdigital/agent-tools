#!/usr/bin/env node
// Explicit-scope comparison of two retained candidate manifests; no transfer.
import { compareCandidates } from './addy-candidate.mjs';

try {
  const [ownerProject, linkedProject, task, boundary, controlId, expectedControlIdentity, ownerDigest, linkedDigest, ...args] = process.argv.slice(2);
  const required = ['--authorize-owner-repository-control', '--authorize-owner-coordination-artifacts', '--authorize-owner-nested-linked-controls',
    '--authorize-linked-repository-control', '--authorize-linked-coordination-artifacts', '--authorize-linked-control'];
  const flags = [], additionalBoundaries = [], excludedPrefixes = [];
  let authorizeExcludedPrefixes = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--authorize-excluded-prefixes' && !authorizeExcludedPrefixes) { authorizeExcludedPrefixes = true; continue; }
    if (flag === '--exclude-prefix' && args[0]) { excludedPrefixes.push(args.shift()); continue; }
    if (flag !== '--additional-owner-boundary') { flags.push(flag); continue; }
    const value = args.shift(), last = value?.lastIndexOf('=') ?? -1, previous = value?.lastIndexOf('=', last - 1) ?? -1;
    if (previous < 1 || last <= previous + 1 || last === value.length - 1) throw new Error('Invalid additional owner boundary');
    additionalBoundaries.push({ path: value.slice(0, previous), controlId: value.slice(previous + 1, last), identity: value.slice(last + 1) });
  }
  if (flags.length !== required.length || new Set(flags).size !== required.length || !required.every(flag => flags.includes(flag)))
    throw new Error('Explicit independent owner and linked control/coordination authorizations required');
  if (authorizeExcludedPrefixes !== (excludedPrefixes.length > 0)) throw new Error('Explicit excluded-prefix authorization and prefixes required together');
  const prefixOptions = excludedPrefixes.length ? { authorizeExcludedPrefixes: true, excludedPrefixes } : {};
  const result = compareCandidates({ ownerProject, linkedProject, task, boundary, controlId, expectedControlIdentity, ownerDigest, linkedDigest, additionalBoundaries,
    ownerAuthorization: { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeNestedLinkedControls: true, ...prefixOptions },
    linkedAuthorization: { authorizeRepositoryControl: true, authorizeCoordinationArtifacts: true, authorizeLinkedControl: true, ...prefixOptions } });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('addy-compare:', error.message);
  process.exitCode = 1;
}
