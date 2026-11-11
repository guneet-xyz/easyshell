# Changelog

## [0.1.1](https://github.com/guneet-xyz/easyshell/compare/v0.1.0...v0.1.1) (2026-11-11)


### Bug Fixes

* **ci:** pass release environment secrets to the problem image publisher ([#350](https://github.com/guneet-xyz/easyshell/issues/350)) ([a2e6c18](https://github.com/guneet-xyz/easyshell/commit/a2e6c18516a6632ba2e7a95b2c78bd0a3429f405))

## 0.1.0 (2026-11-11)


### Features

* **db:** replace Auth.js tables with better-auth schema ([a071075](https://github.com/guneet-xyz/easyshell/commit/a0710756d9404418df58a6c4ef97bef27ce298fc))
* publish problem images to their own easyshell-problems project ([d81280c](https://github.com/guneet-xyz/easyshell/commit/d81280c44c5b1a13238f1977f4996d25403df510))
* **website:** replace next-auth with better-auth and SES magic links ([78c151a](https://github.com/guneet-xyz/easyshell/commit/78c151a1fd255e2eabf9ce3b6094050b6e44eb0a))


### Bug Fixes

* **build:** allow better-sqlite3 native build ([1f94ac5](https://github.com/guneet-xyz/easyshell/commit/1f94ac5f80d188fff4dcfd74378bc926c2a4b45e))
* **coordinator:** a heartbeat brings a stale runner back to active ([357c189](https://github.com/guneet-xyz/easyshell/commit/357c189757291327900c6a52a80e32bf364e7e1b))
* **coordinator:** a heartbeat brings a stale runner back to active ([0e860e5](https://github.com/guneet-xyz/easyshell/commit/0e860e54af31aec1b55b86014672f1f4eac17eeb)), closes [#343](https://github.com/guneet-xyz/easyshell/issues/343)
* **coordinator:** bind the watchdog's stale cutoff as timestamptz ([2061885](https://github.com/guneet-xyz/easyshell/commit/206188553f2dafba51e5678a35c0b4b798ab258d))
* **coordinator:** generate the problem cache in the image build ([5f8d566](https://github.com/guneet-xyz/easyshell/commit/5f8d5661e938f8d919f43c20978e55b331d4fd7b))
* **coordinator:** make submission grading work and stop the claim busy-loop ([af5d5f0](https://github.com/guneet-xyz/easyshell/commit/af5d5f01a4a96fba2b65264f0bb8b3313612f63f))
* **coordinator:** requeue a claimed row on transient errors ([5c6bdaf](https://github.com/guneet-xyz/easyshell/commit/5c6bdafb1d2f42d8c3d19854fea9cd5549a0ae91))
* **db:** register migration 0002 in the drizzle journal ([e103c05](https://github.com/guneet-xyz/easyshell/commit/e103c058d75b72e9aefe156a54d940ccc84b5bd3))
* **deps:** upgrade next to 16.4.5 and patch vulnerable transitive deps ([51791ab](https://github.com/guneet-xyz/easyshell/commit/51791abff52e0a85ccec0278cb36437775f36a2e))
* don't discard starting sessions; oversized output.json is a result ([817acf4](https://github.com/guneet-xyz/easyshell/commit/817acf49dd2e7f1b07f429371670777dfcdee679))
* make main deployable self-hosted: better-auth, SES email, sandbox hardening, grading fixes ([28f4fc9](https://github.com/guneet-xyz/easyshell/commit/28f4fc9dc8b8001812c9481fa0e4b97d0c226155))
* never treat an unreachable engine or runner as a dead session ([d74776a](https://github.com/guneet-xyz/easyshell/commit/d74776a1d345c40c339b222fe1692ab48be5528d))
* raise the user container memory limit to 64 MiB ([f476b7c](https://github.com/guneet-xyz/easyshell/commit/f476b7c384019e3fc35f8802c8dcbe8f1594f882))
* raise the user container memory limit to 64 MiB ([1fcbe10](https://github.com/guneet-xyz/easyshell/commit/1fcbe103a0f3d557c14bdf716433629c09bdc6ed)), closes [#341](https://github.com/guneet-xyz/easyshell/issues/341)
* recover from sessions on dead runners; finish kills sent during start ([23a6c5e](https://github.com/guneet-xyz/easyshell/commit/23a6c5ebc8f23a0e84098c60370e3d912c94cd7c))
* **runner:** bound exec time, written file size and output from user code ([edf43bd](https://github.com/guneet-xyz/easyshell/commit/edf43bde69d620f19626131f7345e9c1b7234287))
* **runner:** disable core dumps in user containers ([711baa7](https://github.com/guneet-xyz/easyshell/commit/711baa7060e0b4a9d225d8ba0bee73e205f71c3c))
* **runner:** harden the sandbox for untrusted user code ([56e8df0](https://github.com/guneet-xyz/easyshell/commit/56e8df01f8e764a7c9faf3e155ecc8c5d4fc61aa))
* **runner:** keep reconciliation away from sessions that are still starting ([be52a3a](https://github.com/guneet-xyz/easyshell/commit/be52a3aa00a512e36528e1a7228a128485097be9))
* **runner:** report a timed-out submission as a failed result, not a retry ([9518def](https://github.com/guneet-xyz/easyshell/commit/9518defb3ec01fdc72259f23bf852177f2cb4462))
* **runner:** ship real runtime modules in the runner image ([1f18829](https://github.com/guneet-xyz/easyshell/commit/1f188299766e36b91ed137f4ba994fe77df8f87f))
* **runner:** stop reconciliation from discarding finished results ([ef005e0](https://github.com/guneet-xyz/easyshell/commit/ef005e0119f2adefced044b2503b44f991acbf81))
* track terminal sessions under one job id on coordinator and runner ([421b80e](https://github.com/guneet-xyz/easyshell/commit/421b80ece904343f36721c903d8e8270af4ccf2e))
* **website:** defer runtime-only setup so the image builds ([83197e5](https://github.com/guneet-xyz/easyshell/commit/83197e5812ed71664a5faeee5470f171449bffd9))
* **website:** enforce per-user caps under concurrent requests ([d5d88de](https://github.com/guneet-xyz/easyshell/commit/d5d88de5941d4735e7719bba84507c2c765993b3))
* **website:** require a verified email for admin access ([3b220ac](https://github.com/guneet-xyz/easyshell/commit/3b220ac94d129d85321e9bed91907e8cae561002))
* **website:** validate sandbox inputs, private submissions, per-user caps ([ddecab8](https://github.com/guneet-xyz/easyshell/commit/ddecab8b21483758692bf40b8354ea2cc713cf68))
