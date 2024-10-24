# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.4.0](https://github.com/poolifier/poolifier/compare/v4.3.0...v4.4.0) (2024-10-24)


### 🚀 Features

* add worker side error stack trace to WorkerError ([#2631](https://github.com/poolifier/poolifier/issues/2631)) ([5fd1e6b](https://github.com/poolifier/poolifier/commit/5fd1e6bf528d56998a64e5238d4428af693b18c8))


### 🐞 Bug Fixes

* **ci:** untanble build from benchmarking scripts ([693da4d](https://github.com/poolifier/poolifier/commit/693da4ddac420003f0e6a03d0090a712bb91fb16))
* fix production build ([96e15f3](https://github.com/poolifier/poolifier/commit/96e15f3d994c6240a6ee50431065e3d593d9f581))


### ⚡ Performance

* speed up isAsyncFunction() helper ([e155dc6](https://github.com/poolifier/poolifier/commit/e155dc6f44e131201196c5537bff363d9d0b79bb))


### 📚 Documentation

* publish documentation ([7bd639b](https://github.com/poolifier/poolifier/commit/7bd639b904e493311f0115d0f2599552f0351ccb))


### 🤖 Automation

* **ci:** handle various release type on npm registry ([c4c9bf6](https://github.com/poolifier/poolifier/commit/c4c9bf60a525a59f85c3385420c77243654d5443))
* **ci:** node 23.x support ([27461e4](https://github.com/poolifier/poolifier/commit/27461e4f1c905185caccbe6ec422df2354b6f1b6))
* **ci:** switch to workflow token ([c7f3208](https://github.com/poolifier/poolifier/commit/c7f32087e98e0b6ea547272b386e9f085721446e))
* **deps-dev:** bump @biomejs/biome in the regular group ([#2624](https://github.com/poolifier/poolifier/issues/2624)) ([c8da00b](https://github.com/poolifier/poolifier/commit/c8da00bf3bde94576ada532b3cfaadec6bc324bc))
* **deps-dev:** bump @types/node in the regular group ([614a923](https://github.com/poolifier/poolifier/commit/614a9238edb101f38f2f8aa2a56533b6ae7a9826))
* **deps-dev:** bump eslint-plugin-jsdoc in the regular group ([a8ab74a](https://github.com/poolifier/poolifier/commit/a8ab74abe2353f855c95b36d6dc8575552d2f75e))
* **deps-dev:** bump neostandard in the regular group ([#2629](https://github.com/poolifier/poolifier/issues/2629)) ([b0bd470](https://github.com/poolifier/poolifier/commit/b0bd470729633f5e2a4513ffdd506d212d9f6754))
* **deps-dev:** bump tatami-ng in the regular group ([#2625](https://github.com/poolifier/poolifier/issues/2625)) ([cd27ebb](https://github.com/poolifier/poolifier/commit/cd27ebba9f493cd5c79398dac5e7c59c2eb685b0))
* **deps-dev:** bump the major group across 6 directories with 1 update ([#2619](https://github.com/poolifier/poolifier/issues/2619)) ([5257d5f](https://github.com/poolifier/poolifier/commit/5257d5f397b397d9460c378b161671c0bf0c6e28))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([848c7ca](https://github.com/poolifier/poolifier/commit/848c7cad1b7b146f90c072d4b57b847649693fbe))
* **deps-dev:** bump the regular group across 6 directories with 1 update ([6f9c249](https://github.com/poolifier/poolifier/commit/6f9c24960a81b252f4b45e671aeeb743eed78a6d))
* **deps-dev:** bump the regular group across 6 directories with 1 update ([71c0ba1](https://github.com/poolifier/poolifier/commit/71c0ba1520c59f9f339d81deacc3ef2a0fc0fcd5))
* **deps-dev:** bump the regular group with 2 updates ([5f7136a](https://github.com/poolifier/poolifier/commit/5f7136ad9ec4b43734a423661058a421accb8799))
* **deps:** bump the all group across 11 directories with 1 update ([fac6bb8](https://github.com/poolifier/poolifier/commit/fac6bb836f2648221ce707dd311073f4b72daade))

## [4.3.0](https://github.com/poolifier/poolifier/compare/v4.2.11...v4.3.0) (2024-10-14)


### 🚀 Features

* **benchmarks:** add bencher threshold checks ([e56c70e](https://github.com/poolifier/poolifier/commit/e56c70ec471b0ebfccfa0ab0f31be391221d948c))


### 🐞 Bug Fixes

* **benchmarks:** add upper/lower values to BMF throughput ([d6e6b64](https://github.com/poolifier/poolifier/commit/d6e6b6414d53a81d81eeae068eb87d6eaf707038))
* **benchmarks:** fix BMF report upper/lower values ([0a98c64](https://github.com/poolifier/poolifier/commit/0a98c64c82e0102042da0eaebf8fed78691261a1))
* fix benchmarks report conversion to BMF format ([8a93e4e](https://github.com/poolifier/poolifier/commit/8a93e4eeb91c673d68a858126b090e8613a950d5))


### ⚡ Performance

* pre-create worker if needed at the end of task execution ([1d5588f](https://github.com/poolifier/poolifier/commit/1d5588f7a7157f4214c0f326c294cd966525bee3))


### ✨ Polish

* cleanup task function ops validation ([f9e6cc3](https://github.com/poolifier/poolifier/commit/f9e6cc35ca852305c1a6e6a784dadfcb8f9712fc))
* enable `.editorconfig` in biome formatter ([cc46610](https://github.com/poolifier/poolifier/commit/cc46610423b11000bcd11e869db96f28d90ce825))
* turn on `noImplicitOverride` in TS configuration ([ae85b35](https://github.com/poolifier/poolifier/commit/ae85b3512e8a94e5c66aec8a5e9caa6b8b575137))


### 📚 Documentation

* publish documentation ([b83ac2a](https://github.com/poolifier/poolifier/commit/b83ac2ad12bdcb264f1d94b546b0c46196123e11))


### 🤖 Automation

* **ci:** fix task function ops tests ([c79f502](https://github.com/poolifier/poolifier/commit/c79f502de546aa2133e3321bd84668c598f5afc3))
* **ci:** silence linter error ([0fd6ad4](https://github.com/poolifier/poolifier/commit/0fd6ad4619f547ee56218f2ef45ea1a36c4b0dfe))
* **deps-dev:** bump @cspell/eslint-plugin in the regular group ([#2579](https://github.com/poolifier/poolifier/issues/2579)) ([954778b](https://github.com/poolifier/poolifier/commit/954778bc3120e150c9bbb904ea2e4b0c2ab6934f))
* **deps-dev:** bump @eslint/js in the regular group ([f487972](https://github.com/poolifier/poolifier/commit/f487972951aeb84bb03e1156550f64446f3b9b45))
* **deps-dev:** bump @types/node in the regular group ([17f15a0](https://github.com/poolifier/poolifier/commit/17f15a0472724873c6c241e743badb23047b919c))
* **deps-dev:** bump @types/nodemailer ([bba21a2](https://github.com/poolifier/poolifier/commit/bba21a24b3054a5ebd4d9a1b37ff1ebdd7428877))
* **deps-dev:** bump eslint-plugin-jsdoc in the regular group ([e1332ea](https://github.com/poolifier/poolifier/commit/e1332ea1bc5d116788bb5463d5d0d09b4ab584b3))
* **deps-dev:** bump sinon from 18.0.1 to 19.0.2 in the major group ([e62369f](https://github.com/poolifier/poolifier/commit/e62369f6c29dc0368e2c6877cc9949756f1209ef))
* **deps-dev:** bump tatami-ng from 0.7.0 to 0.7.1 in the regular group ([e272166](https://github.com/poolifier/poolifier/commit/e272166179f064bdc45ffd39cff811a80daba221))
* **deps-dev:** bump tatami-ng from 0.8.2 to 0.8.3 in the regular group ([f0bab52](https://github.com/poolifier/poolifier/commit/f0bab521b687398be745405eebbe5b4da60b7612))
* **deps-dev:** bump tatami-ng from 0.8.3 to 0.8.4 in the regular group ([e589b14](https://github.com/poolifier/poolifier/commit/e589b1452ef3aefb36fac45c98ccb3b5753bb756))
* **deps-dev:** bump the major group across 3 directories with 1 update ([00d085d](https://github.com/poolifier/poolifier/commit/00d085dd864fa20f7107ddef968b785283d90725))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([10180df](https://github.com/poolifier/poolifier/commit/10180dfdf01ebdff3c41c39a7ab3dded43609b57))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([#2584](https://github.com/poolifier/poolifier/issues/2584)) ([6a1b9a9](https://github.com/poolifier/poolifier/commit/6a1b9a9f3315cc06ef90d3c9981cb28fb31a1b3b))
* **deps-dev:** bump the regular group across 11 directories with 2 updates ([9bfa445](https://github.com/poolifier/poolifier/commit/9bfa44570641dd9afb774614e235b52807ae6a04))
* **deps-dev:** bump the regular group across 6 directories with 1 update ([#2581](https://github.com/poolifier/poolifier/issues/2581)) ([338568b](https://github.com/poolifier/poolifier/commit/338568b431ef543ebf25d98bc352b66cfa2a4a4c))
* **deps-dev:** bump the regular group with 2 updates ([ff958ab](https://github.com/poolifier/poolifier/commit/ff958ab9a720b554e7479ac6b3dd61fbfb97d642))
* **deps-dev:** bump the regular group with 2 updates ([4fbd388](https://github.com/poolifier/poolifier/commit/4fbd3883fc88c3f0e98d1a046c323c1ce84e2390))
* **deps-dev:** bump the regular group with 2 updates ([bca88d2](https://github.com/poolifier/poolifier/commit/bca88d2ee41f6084a3afe045c394383e316e82e5))
* **deps-dev:** bump the regular group with 2 updates ([ce4ca7a](https://github.com/poolifier/poolifier/commit/ce4ca7aef6c535099c3cecc9ac40034040b54457))
* **deps-dev:** bump the regular group with 2 updates ([#2583](https://github.com/poolifier/poolifier/issues/2583)) ([49ad9d2](https://github.com/poolifier/poolifier/commit/49ad9d2cb0ebb46a1345cce79e05beadd75e4fb2))
* **deps-dev:** bump the regular group with 3 updates ([#2582](https://github.com/poolifier/poolifier/issues/2582)) ([eaeb55b](https://github.com/poolifier/poolifier/commit/eaeb55b94c879baedc17a81309ba07eb7999a880))
* **deps-dev:** bump the regular group with 4 updates ([#2585](https://github.com/poolifier/poolifier/issues/2585)) ([dab2d0f](https://github.com/poolifier/poolifier/commit/dab2d0f028c9ec108d7648cdf45d04ee0e83f891))
* **deps-dev:** bump typescript ([1e9bf5f](https://github.com/poolifier/poolifier/commit/1e9bf5f3e96ae171eeebe17b48f05b8f3cee833f))
* **deps-dev:** bump typescript ([dedf743](https://github.com/poolifier/poolifier/commit/dedf743862d71cb6786e7ad9fd32d5e77bd94b26))
* **deps-dev:** bump typescript ([425925a](https://github.com/poolifier/poolifier/commit/425925a3f8b0a894790b0863b4718f61ebaaad7a))
* **deps-dev:** bump typescript ([94fba1e](https://github.com/poolifier/poolifier/commit/94fba1ef4e23f262b0996c30148209927c414d2e))
* **deps-dev:** bump typescript ([b4d6c8f](https://github.com/poolifier/poolifier/commit/b4d6c8fa0ac5e621549748de76fbab68932cea1b))
* **deps-dev:** bump typescript ([10c8877](https://github.com/poolifier/poolifier/commit/10c8877ed31cbca22539ac0a37724de7c127734d))
* **deps-dev:** bump typescript ([2c623f9](https://github.com/poolifier/poolifier/commit/2c623f953cdb9e073118246e088b9a3892b114ab))
* **deps-dev:** bump typescript ([a404672](https://github.com/poolifier/poolifier/commit/a404672dab88a94ae6638a2f7fc2bd447da65869))
* **deps-dev:** bump typescript ([895a334](https://github.com/poolifier/poolifier/commit/895a33466d8921366cf413ee4eaed7ee3544f590))
* **deps-dev:** bump typescript ([c154fe0](https://github.com/poolifier/poolifier/commit/c154fe038bbec17f0e21064aeffec01749ba9230))
* **deps-dev:** bump typescript ([4ea88eb](https://github.com/poolifier/poolifier/commit/4ea88eb07a4acd6fb915913fe3b430ab5cdcf924))
* **deps:** bump github/combine-prs from 5.1.0 to 5.2.0 ([e6a7b43](https://github.com/poolifier/poolifier/commit/e6a7b43c7802976e15af2b4b0cd52e3d6941fe72))
* **deps:** bump sonarsource/sonarcloud-github-action ([6855943](https://github.com/poolifier/poolifier/commit/68559434ddc933eace0553f348b24454c67fa480))
* **deps:** bump the major group across 3 directories with 2 updates ([e990af6](https://github.com/poolifier/poolifier/commit/e990af616c4915a2777cd161a8b9b7c348c26482))
* **deps:** bump the regular group across 11 directories with 1 update ([a721023](https://github.com/poolifier/poolifier/commit/a72102361d5f755a23e3d6cb7efb5b38ee1b6920))
* **deps:** bump the regular group across 3 directories with 1 update ([29ed11a](https://github.com/poolifier/poolifier/commit/29ed11aa9e9fb030c22278720059d42a42be4354))

## [4.2.11](https://github.com/poolifier/poolifier/compare/v4.2.10...v4.2.11) (2024-09-12)


### ⚡ Performance

* track dynamic pool empty event lifecycle ([7923fe5](https://github.com/poolifier/poolifier/commit/7923fe59f4a88b218744b16f977faf93015407ac))


### ✨ Polish

* add dynamic worker nodes count to pool info ([01277ce](https://github.com/poolifier/poolifier/commit/01277ce688c015fff1bee425276b20077e7a8f34))


### 🧪 Tests

* refine dynamic pool shutdown test expectations ([fc43a51](https://github.com/poolifier/poolifier/commit/fc43a5150338466915bc57705d00bd0e5255eac7))


### 📚 Documentation

* publish documentation ([4a809cf](https://github.com/poolifier/poolifier/commit/4a809cfc7dd384ec3c8dd8304d99d2160cf94466))


### 🤖 Automation

* **deps-dev:** bump sinon from 18.0.0 to 18.0.1 in the regular group ([947d358](https://github.com/poolifier/poolifier/commit/947d35846a27cece641eb08f6ea9b7be1d3dd03e))
* **deps-dev:** bump the regular group with 2 updates ([efd5d49](https://github.com/poolifier/poolifier/commit/efd5d49802507ee6c963abe45aa7446387aad347))
* **deps:** bump the regular group across 11 directories with 1 update ([#2568](https://github.com/poolifier/poolifier/issues/2568)) ([678986c](https://github.com/poolifier/poolifier/commit/678986c1623ff15844a0f633bfd0fdab87a20362))
* **deps:** bump the regular group across 3 directories with 1 update ([7e6cc27](https://github.com/poolifier/poolifier/commit/7e6cc278973d7b013e49afa56dba33ef6b50908b))

## [4.2.10](https://github.com/poolifier/poolifier/compare/v4.2.9...v4.2.10) (2024-09-06)


### ⚡ Performance

* optimize backpressure task(s) stealing conditions ([9df97af](https://github.com/poolifier/poolifier/commit/9df97afd77c24c8850e0d56eae3d3c66df181981))


### ✨ Polish

* add `isWorkerNodeStealing()` helper ([febcf8e](https://github.com/poolifier/poolifier/commit/febcf8e370ebf9ed2e45ba25296e937277d61e93))
* factor out stealing ratio conditions check into an helper ([207df8a](https://github.com/poolifier/poolifier/commit/207df8aa5381ac3d3ca1f10d9cb79e01593ba10f))


### 🧪 Tests

* cleanup error handling expectations ([d960e54](https://github.com/poolifier/poolifier/commit/d960e542b476b90385e962c9be41422860310426))


### 📚 Documentation

* add `mapExecute` implementation to fastify examples plugin ([3924d83](https://github.com/poolifier/poolifier/commit/3924d83878275190248eb13b8f814b82c7dde655))
* add missing `mapExecute` type definition to fastify examples ([83572f4](https://github.com/poolifier/poolifier/commit/83572f443b105de35a127423b53909fab3bd6ced))
* code cleanup in examples ([24bc951](https://github.com/poolifier/poolifier/commit/24bc951b90abfe7a365ef6323888d51fde479552))
* publish documentation ([d3a3b16](https://github.com/poolifier/poolifier/commit/d3a3b16f4443cdfda453e56570a0873863df2d03))
* switch to `mapExecute()` in examples ([8162986](https://github.com/poolifier/poolifier/commit/8162986eb9aff717ad56bed372abd6c63fe2a31d))


### 🤖 Automation

* **deps-dev:** bump @types/node in the regular group ([fb8923f](https://github.com/poolifier/poolifier/commit/fb8923f8a793d0ba9b47834885bf63ea64346229))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([8ae78fb](https://github.com/poolifier/poolifier/commit/8ae78fbe85be6e5f61fa4f96f3ee93c1ce006bf7))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([4a2b738](https://github.com/poolifier/poolifier/commit/4a2b73815c9a8903ac44358c8e6e182ceb2657f5))
* **deps-dev:** bump the regular group with 2 updates ([b1b652f](https://github.com/poolifier/poolifier/commit/b1b652f50ff2a3b1a55072a1f07955b7c1a262c0))
* **deps:** bump nodemailer ([552013f](https://github.com/poolifier/poolifier/commit/552013f092a9785c5a80b8849c462a5b75ac5d3d))
* **deps:** bump the regular group across 11 directories with 2 updates ([302fa26](https://github.com/poolifier/poolifier/commit/302fa26acd5997c297caa723095d36890d4390e1))
* **deps:** bump the regular group across 11 directories with 2 updates ([#2557](https://github.com/poolifier/poolifier/issues/2557)) ([eb97198](https://github.com/poolifier/poolifier/commit/eb97198de6c8c4a407009c4b1c56497aae41b11a))

## [4.2.9](https://github.com/poolifier/poolifier/compare/v4.2.8...v4.2.9) (2024-08-30)


### 🐞 Bug Fixes

* handle properly small or zero `tasksStealingRatio` ([e45f621](https://github.com/poolifier/poolifier/commit/e45f62158cd1a0e899173a453b1fa43fb8ce7bba))


### 📚 Documentation

* publish documentation ([41a50df](https://github.com/poolifier/poolifier/commit/41a50dfe7c49c05bf2cd8a9cc0a6ff47385836e4))

## [4.2.8](https://github.com/poolifier/poolifier/compare/v4.2.7...v4.2.8) (2024-08-30)


### 🐞 Bug Fixes

* fix dynamic thread pool full event emission rate ([52021de](https://github.com/poolifier/poolifier/commit/52021de72b77aa6c6fdd7c6dd816d7d53e6b2feb))


### ✨ Polish

* move dynamic pool only getters to its own class ([21e6b0e](https://github.com/poolifier/poolifier/commit/21e6b0ef4c8b89dbf4f8c588ae50887ce1f5177f))


### 🧪 Tests

* refine pool event tests expectation ([6a30766](https://github.com/poolifier/poolifier/commit/6a307669ef6f5aae3a8b79504255a8d3bdfd7c86))


### 📚 Documentation

* publish documentation ([bc407dc](https://github.com/poolifier/poolifier/commit/bc407dc6774b90aed4c7e2083f6adc765184dc69))
* **README.md:** fix worker example export ([a5844a0](https://github.com/poolifier/poolifier/commit/a5844a0fffdb82f3890ff87fd0a75860edc20eea))
* **README.md:** use top level await syntax in example ([3b4d090](https://github.com/poolifier/poolifier/commit/3b4d090fab7dd028a45d8ed12b02837919106084))
* refine pool ready event emission condition ([3abc7fe](https://github.com/poolifier/poolifier/commit/3abc7fe895e74ae347ab729569f94d25729fceb1))


### 🤖 Automation

* **deps-dev:** bump the regular group with 3 updates ([d707c4d](https://github.com/poolifier/poolifier/commit/d707c4dc46af6311323aa7a0a235e1f6cbd30d1b))
* **deps:** bump the regular group across 11 directories with 2 updates ([5c2e6e8](https://github.com/poolifier/poolifier/commit/5c2e6e8b247a9869cc7dc0989e6caaec8c0e1fe0))

## [4.2.7](https://github.com/poolifier/poolifier/compare/v4.2.6...v4.2.7) (2024-08-28)


### ⚡ Performance

* reduce useless branching at pool info building ([4a29667](https://github.com/poolifier/poolifier/commit/4a29667ae71425df81946f45951e90aef20986e9))
* track dynamic pool full lifecycle via events ([5f9e905](https://github.com/poolifier/poolifier/commit/5f9e90500ddf396a1862479540a4784bca043a20))


### ✨ Polish

* cleanup pool information ordering ([ba443f4](https://github.com/poolifier/poolifier/commit/ba443f407e3d94f83bb8d013f7552b271bd3d445))
* merge dynamic pool events emission code ([e6cf2a9](https://github.com/poolifier/poolifier/commit/e6cf2a95dd56b9683ed81b622f5565c97a60e5a1))


### 🧪 Tests

* improve pool empty event test ([4b91b77](https://github.com/poolifier/poolifier/commit/4b91b77184b873be455d65b91719f747bb460778))


### 📚 Documentation

* publish documentation ([f948bb3](https://github.com/poolifier/poolifier/commit/f948bb3ef36f727934404c7a490075d431022e39))


### 🤖 Automation

* **deps-dev:** bump eslint-plugin-perfectionist from 3.2.0 to 3.3.0 in the regular group ([#2549](https://github.com/poolifier/poolifier/issues/2549)) ([60b5fab](https://github.com/poolifier/poolifier/commit/60b5fabe702dab1324f95b2353d8710b6694ec2b))
* **deps:** bump the regular group across 11 directories with 1 update ([#2550](https://github.com/poolifier/poolifier/issues/2550)) ([7cfe89c](https://github.com/poolifier/poolifier/commit/7cfe89c198cb3f0174713642e4bcddc0ddc1451f))

## [4.2.6](https://github.com/poolifier/poolifier/compare/v4.2.5...v4.2.6) (2024-08-27)


### 🐞 Bug Fixes

* fix pool back pressure semantic on dynamic pool ([227e9e9](https://github.com/poolifier/poolifier/commit/227e9e9b75b8e004dd7651af5961490e58ffdda9))


### ⚡ Performance

* track pool back pressure lifecycle via events ([303c0db](https://github.com/poolifier/poolifier/commit/303c0db0528190df1f9f726e96c49dbb10f09d27))
* track pool busy lifecycle via events ([f8a57da](https://github.com/poolifier/poolifier/commit/f8a57da1a44233d40635aabba944ed036258f8ab))


### ✨ Polish

* cleanup worker node back pressure checks ([697d8c6](https://github.com/poolifier/poolifier/commit/697d8c6debe324881015e70f43f708c6880be92a))


### 📚 Documentation

* publish documentation ([22cdcdd](https://github.com/poolifier/poolifier/commit/22cdcddef65fbcad1f91bbdbec4788c9b81d29be))


### 🤖 Automation

* **deps-dev:** bump the regular group with 2 updates ([46c6476](https://github.com/poolifier/poolifier/commit/46c6476ed661a91b88a48025faf9bd0c7ed387a6))
* **deps:** bump the regular group across 11 directories with 2 updates ([43922bf](https://github.com/poolifier/poolifier/commit/43922bfb3902595907ce671a8a245b1f9ee09067))

## [4.2.5](https://github.com/poolifier/poolifier/compare/v4.2.4...v4.2.5) (2024-08-26)


### 🐞 Bug Fixes

* ensure no deleted dynamic worker can be used to steal task(s) ([60ff5f0](https://github.com/poolifier/poolifier/commit/60ff5f050aac60f90e63638029b88e80e91e259c))


### ✨ Polish

* cleanup worker node back pressure detection implementation ([6546b6a](https://github.com/poolifier/poolifier/commit/6546b6a8ba008ea2be1a3ecc129054f4b84417c2))
* cleanup worker node state conditions check ([2a8bfdf](https://github.com/poolifier/poolifier/commit/2a8bfdff6ba9391ec6dd0f733b23d39633583bcb))


### 📚 Documentation

* publish documentation ([200c455](https://github.com/poolifier/poolifier/commit/200c455f716523a3f14500435cf834cc1ae86880))

## [4.2.4](https://github.com/poolifier/poolifier/compare/v4.2.3...v4.2.4) (2024-08-24)


### 🐞 Bug Fixes

* fix pool ready status with zero min size dynamic pool ([e48fa7a](https://github.com/poolifier/poolifier/commit/e48fa7a7cd32d0b42df79043b773fcb1e6f2c778))


### ✨ Polish

* switch to eslint-plugin-perfectionist ([9723108](https://github.com/poolifier/poolifier/commit/972310863f23533360c1021be9c00f375230f81d))


### 🧪 Tests

* add pool empty event test ([7682c56](https://github.com/poolifier/poolifier/commit/7682c56f39d439b949dd02f1c3a251e261d1eb49))
* optimize pool empty event test ([fa97876](https://github.com/poolifier/poolifier/commit/fa97876e2e8c5d8b507bc467bf8026f9a6573628))


### 📚 Documentation

* publish documentation ([4073f18](https://github.com/poolifier/poolifier/commit/4073f18713bcccfae354c3eb03c63e5a50496192))
* refine a code comment ([cee9a55](https://github.com/poolifier/poolifier/commit/cee9a55aca4d0794d9d64fbd7b7206375c34f27b))


### 🤖 Automation

* **deps-dev:** bump husky from 9.1.4 to 9.1.5 in the regular group ([#2538](https://github.com/poolifier/poolifier/issues/2538)) ([d25e4f5](https://github.com/poolifier/poolifier/commit/d25e4f5f8b03f55e6a3be7791bfb1f37fbad0162))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([#2539](https://github.com/poolifier/poolifier/issues/2539)) ([dd24a54](https://github.com/poolifier/poolifier/commit/dd24a543d47b006d2b84a1a031894f46c169abe7))
* **deps-dev:** bump the regular group with 2 updates ([205d209](https://github.com/poolifier/poolifier/commit/205d209cbb2e82e4245f534e32ab7cf9e01aea78))
* **deps:** bump sonarsource/sonarcloud-github-action ([#2537](https://github.com/poolifier/poolifier/issues/2537)) ([82e0653](https://github.com/poolifier/poolifier/commit/82e065399f9c5a1aa48f0da8c117794f6b7d0dbf))
* **deps:** bump the regular group across 11 directories with 3 updates ([#2536](https://github.com/poolifier/poolifier/issues/2536)) ([b901726](https://github.com/poolifier/poolifier/commit/b901726ffdcb1d987818057afb4779c1673a273a))
* **deps:** bump the regular group across 7 directories with 2 updates ([e559d2d](https://github.com/poolifier/poolifier/commit/e559d2d191ddb9d622e05ba9c414d1a4e64406d0))

## [4.2.3](https://github.com/poolifier/poolifier/compare/v4.2.2...v4.2.3) (2024-08-19)


### 🐞 Bug Fixes

* account for all stealing worker nodes ([d967235](https://github.com/poolifier/poolifier/commit/d9672350c04638ef28b10b6f480e8e7cd89256f0))


### ✨ Polish

* define a variable only when needed ([4f28c7a](https://github.com/poolifier/poolifier/commit/4f28c7ae4e0c53cb328c4e5bdfe246f02fe1baf2))
* display back pressured worker nodes in pool info ([8c7a518](https://github.com/poolifier/poolifier/commit/8c7a518dde490c0d370dff2e47ee86062d715dad))


### 📚 Documentation

* publish documentation ([e4db94f](https://github.com/poolifier/poolifier/commit/e4db94fc95fd5bb37fd446516f29b62fe38dc7fb))


### 🤖 Automation

* **deps-dev:** apply updates ([5a96b64](https://github.com/poolifier/poolifier/commit/5a96b64531b368fd4bf10225d48f7561fae4c90d))
* **deps-dev:** bump @types/node in the regular group ([#2533](https://github.com/poolifier/poolifier/issues/2533)) ([b2cd95b](https://github.com/poolifier/poolifier/commit/b2cd95b7775f9a742a57de02d61a74dfef0aad24))
* **deps-dev:** bump eslint-plugin-jsdoc in the regular group ([d20645f](https://github.com/poolifier/poolifier/commit/d20645fe19102bd39357bb23979f7684fe9fd5e3))
* **deps-dev:** bump the regular group across 11 directories with 1 update ([#2534](https://github.com/poolifier/poolifier/issues/2534)) ([a9c233d](https://github.com/poolifier/poolifier/commit/a9c233d841db2bd396829465d16682e160e82093))
* **deps:** bump the regular group across 11 directories with 2 updates ([c657b5d](https://github.com/poolifier/poolifier/commit/c657b5df7dc5bbd8b63f6b2ced8c5d7b574c5969))

## [4.2.2](https://github.com/poolifier/poolifier/compare/v4.2.1...v4.2.2) (2024-08-14)


### 🐞 Bug Fixes

* fix race condition at task response handling during pool destroy ([b28533a](https://github.com/poolifier/poolifier/commit/b28533a38f984b6a28edf6edc53940bd85f24200))
* workaround race conditions at pool destroy ([684f132](https://github.com/poolifier/poolifier/commit/684f132a0f46afc01f2e95ec004ecfd2548b8d49))


### 📚 Documentation

* publish documentation ([df66bb1](https://github.com/poolifier/poolifier/commit/df66bb1d802af27d29b1ca2e29b0b1c95636b0e1))

## [4.2.1](https://github.com/poolifier/poolifier/compare/v4.2.0...v4.2.1) (2024-08-14)


### 🐞 Bug Fixes

* ensure task stealing can't start twice on the same worker node ([37cc14e](https://github.com/poolifier/poolifier/commit/37cc14e81ea8e83ea2b78cf27e0e74f3c4694e21))
* trigger continuous tasks stealing under proper conditions ([2663563](https://github.com/poolifier/poolifier/commit/2663563da5f52fd57be41127e5c789c86e969ae7))


### ✨ Polish

* remove unneeded condition at task response handling ([93df097](https://github.com/poolifier/poolifier/commit/93df097ec6c54af9f0d29df0cb61cb901f29fca4))


### 📚 Documentation

* publish documentation ([b4f9421](https://github.com/poolifier/poolifier/commit/b4f9421addf669cffe56d2f30f0fbab42dfe9755))
* refine code comment about task stealing conditions ([80716e5](https://github.com/poolifier/poolifier/commit/80716e5039fb14c3731fa6b7f22334fcd4e5b314))


### 🤖 Automation

* **deps-dev:** bump eslint-plugin-jsdoc in the regular group ([#2525](https://github.com/poolifier/poolifier/issues/2525)) ([b9873cb](https://github.com/poolifier/poolifier/commit/b9873cbec16f627e05dfb354521c34540722df0c))
* **deps:** bump the regular group across 11 directories with 2 updates ([#2526](https://github.com/poolifier/poolifier/issues/2526)) ([d3167a7](https://github.com/poolifier/poolifier/commit/d3167a7e6ee5dea226278a26813e6b64b49aa1d2))

## [4.2.0](https://github.com/poolifier/poolifier/compare/v4.1.0...v4.2.0) (2024-08-13)


### 🚀 Features

* reenable tasks stealing under back pressure by default ([f09b195](https://github.com/poolifier/poolifier/commit/f09b195471d82466f32dfbc3c3751202d4ea2f9a))


### 🐞 Bug Fixes

* protect worker node tasks queue from concurrent tasks stealing ([eebfd81](https://github.com/poolifier/poolifier/commit/eebfd819241181d59144f45b51f566fca0211fc5))


### ⚡ Performance

* do mapExecute() args sanity checks once ([390300c](https://github.com/poolifier/poolifier/commit/390300c363d3535fd622f07d54c40cfad9fdbb0b))


### ✨ Polish

* cleanup eslint configuration ([d5f06e4](https://github.com/poolifier/poolifier/commit/d5f06e40422119fca0b15562883f9060f466f673))
* cleanup worker condition checks at task stealing ([d52d477](https://github.com/poolifier/poolifier/commit/d52d4773cc0ed2936aea894224a7edc3dab8359a))


### 🧪 Tests

* cleanup fixed pool tests setup and teardown ([311c5bd](https://github.com/poolifier/poolifier/commit/311c5bdbcf67f99f8cc8f066ecd92fc42a670f8d))
* cleanup resources setup and teardown ([e1e0cb2](https://github.com/poolifier/poolifier/commit/e1e0cb25f128238f3f7b3a49f41fa5e5be236577))
* remove duplicate tests ([55a9fbc](https://github.com/poolifier/poolifier/commit/55a9fbccadf29da6e3cb30471f3a5ce1e0d7c641))


### 📚 Documentation

* add documentation on enablePrority priority queue getter/setter ([3e53cc1](https://github.com/poolifier/poolifier/commit/3e53cc14e502b532f31536efefe84212c98ee024))
* **api:** add missing tasksStealingRatio default value ([5b65da9](https://github.com/poolifier/poolifier/commit/5b65da9662b764070a8414e2cce53294f5fd9498))
* publish documentation ([e57792c](https://github.com/poolifier/poolifier/commit/e57792c1bbb944b28efe0a34027ac1e35ffd62d5))


### 🤖 Automation

* **ci:** reenabled code auto formatting and linting ([31e5cb9](https://github.com/poolifier/poolifier/commit/31e5cb9aa2c33ea879afa99d649024495bb25a69))
* **ci:** silence linter on examples ([6a2f448](https://github.com/poolifier/poolifier/commit/6a2f448092feecf09f4cfbb2578cdeef334c8ae3))
* **deps-dev:** bump @commitlint/cli in the regular group ([#2518](https://github.com/poolifier/poolifier/issues/2518)) ([798d464](https://github.com/poolifier/poolifier/commit/798d46431c8b35674774ec0c64b343f5103b1d88))
* **deps-dev:** bump @cspell/eslint-plugin from 8.11.0 to 8.12.1 ([cb4a4fd](https://github.com/poolifier/poolifier/commit/cb4a4fdfd62e2a5f5634f72ba7ced50186d28e7d))
* **deps-dev:** bump @cspell/eslint-plugin from 8.12.1 to 8.13.0 ([#2490](https://github.com/poolifier/poolifier/issues/2490)) ([d94680b](https://github.com/poolifier/poolifier/commit/d94680bbed7f9eda7cde673afea03d67ed845600))
* **deps-dev:** bump @cspell/eslint-plugin from 8.13.0 to 8.13.1 ([f4b46c2](https://github.com/poolifier/poolifier/commit/f4b46c288bdb341fc1190448ff6b628d5b0f434f))
* **deps-dev:** bump @types/node ([898fb96](https://github.com/poolifier/poolifier/commit/898fb967397af40c848e856f7567dce2e4246b5a))
* **deps-dev:** bump @types/node ([b83105c](https://github.com/poolifier/poolifier/commit/b83105cb20f971e62ffd4d9af8b8a02bbb603121))
* **deps-dev:** bump @types/node ([30ccf3b](https://github.com/poolifier/poolifier/commit/30ccf3bee1938152352d7ac8698106527e4c541f))
* **deps-dev:** bump @types/node ([72e99f3](https://github.com/poolifier/poolifier/commit/72e99f3f9850f4236f292a94fcf48f6ed08a62ce))
* **deps-dev:** bump @types/node ([6032c66](https://github.com/poolifier/poolifier/commit/6032c66cfc168a7aa3cc690fd44a17e33ae505fc))
* **deps-dev:** bump @types/node ([90a355a](https://github.com/poolifier/poolifier/commit/90a355a3c8d1f9f2bb3f726649d8dd194ea9aa29))
* **deps-dev:** bump @types/node ([dc72c1f](https://github.com/poolifier/poolifier/commit/dc72c1f0c0cb7af045f263c1e676fddc8638ab51))
* **deps-dev:** bump @types/node ([9072888](https://github.com/poolifier/poolifier/commit/9072888d09e8cec7b57e1a42db95a12cdae13f43))
* **deps-dev:** bump @types/node ([4001e8f](https://github.com/poolifier/poolifier/commit/4001e8f12ee43978182130e3b0e21791a2a5abda))
* **deps-dev:** bump @types/node ([4b3f7ff](https://github.com/poolifier/poolifier/commit/4b3f7ff2e5d62eca78e284b036e2bbb31ba57c30))
* **deps-dev:** bump @types/node ([bffa27b](https://github.com/poolifier/poolifier/commit/bffa27b440f0d16c127360e547660a3fcfb20e1e))
* **deps-dev:** bump @types/node ([51b8676](https://github.com/poolifier/poolifier/commit/51b86762f930675d14fa0ffd03979138bbf54d21))
* **deps-dev:** bump @types/node ([84e2af2](https://github.com/poolifier/poolifier/commit/84e2af234d00ab6ab3eb5cec2fcd450f67f72626))
* **deps-dev:** bump @types/node from 20.14.11 to 20.14.12 ([#2484](https://github.com/poolifier/poolifier/issues/2484)) ([b04790a](https://github.com/poolifier/poolifier/commit/b04790ac130cdcce1673f544c8a90cd572bbfff8))
* **deps-dev:** bump @types/node from 22.0.2 to 22.1.0 ([e2c63d9](https://github.com/poolifier/poolifier/commit/e2c63d928d3f61085bc63ef0e2ed861827e44952))
* **deps-dev:** bump eslint-plugin-jsdoc from 48.10.2 to 48.11.0 ([a335dbb](https://github.com/poolifier/poolifier/commit/a335dbb80f8ce31ec11c282d2dc4095d7356cbba))
* **deps-dev:** bump eslint-plugin-jsdoc from 48.9.2 to 48.10.2 ([#2489](https://github.com/poolifier/poolifier/issues/2489)) ([7740dd2](https://github.com/poolifier/poolifier/commit/7740dd271aa7fbd4bcedf659b323813d6d72030f))
* **deps-dev:** bump eslint-plugin-jsdoc in the major group ([#2519](https://github.com/poolifier/poolifier/issues/2519)) ([97be5ef](https://github.com/poolifier/poolifier/commit/97be5ef840aad32606fa1b0d0699fa5d99810028))
* **deps-dev:** bump husky from 9.1.2 to 9.1.3 ([#2487](https://github.com/poolifier/poolifier/issues/2487)) ([788cee8](https://github.com/poolifier/poolifier/commit/788cee84f1e30debe570409c650df1ae9d67ab68))
* **deps-dev:** bump rollup ([cc75e8e](https://github.com/poolifier/poolifier/commit/cc75e8e09934047cf1babb634275e6c5106f6871))
* **deps-dev:** bump rollup ([b802739](https://github.com/poolifier/poolifier/commit/b802739585892c8184ec2ec55f0c49c477cadcdb))
* **deps-dev:** bump rollup ([1d82f1e](https://github.com/poolifier/poolifier/commit/1d82f1e2c8f6e3762d746a3e091d6f266fa7313d))
* **deps-dev:** bump rollup ([18ccae8](https://github.com/poolifier/poolifier/commit/18ccae8c892047167f16ccdc883776887d2d93d5))
* **deps-dev:** bump rollup ([e45d209](https://github.com/poolifier/poolifier/commit/e45d209d147f46be21407a09f3aace31bcbffbe2))
* **deps-dev:** bump rollup ([865b4f5](https://github.com/poolifier/poolifier/commit/865b4f5ac20df164a97de317a44e42ee0dd4b6a0))
* **deps-dev:** bump rollup from 4.19.1 to 4.19.2 ([caf6fe3](https://github.com/poolifier/poolifier/commit/caf6fe30f20a5aee16e51dfc9026296974f4728b))
* **deps-dev:** bump the regular group with 2 updates ([#2523](https://github.com/poolifier/poolifier/issues/2523)) ([cc9a0fb](https://github.com/poolifier/poolifier/commit/cc9a0fb31ab867c2b84f15f5cc61a85644753adb))
* **deps-dev:** bump typedoc from 0.26.4 to 0.26.5 ([27433e0](https://github.com/poolifier/poolifier/commit/27433e06f8bff51b1462c1ecf2d17869551d7468))
* **deps-dev:** update eslint-plugin-jsdoc to 50.2.0 ([25bf98e](https://github.com/poolifier/poolifier/commit/25bf98e1bc2eff8103e1eb67db9d7dde5cbf96b8))
* **deps:** bump axios in /examples/typescript/http-client-pool ([#2501](https://github.com/poolifier/poolifier/issues/2501)) ([9c8c7b6](https://github.com/poolifier/poolifier/commit/9c8c7b629ce608a0dd7b87c8b4f03cc72842c44e))
* **deps:** bump github/combine-prs from 5.0.0 to 5.1.0 ([#2476](https://github.com/poolifier/poolifier/issues/2476)) ([9c14720](https://github.com/poolifier/poolifier/commit/9c1472043fc2b5b77f16a271c26457a4a180e3f2))

## [4.1.0](https://github.com/poolifier/poolifier/compare/v4.0.18...v4.1.0) (2024-07-18)


### 🚀 Features

* add ratio of worker nodes in a pool allowed to perform concurrent tasks stealing ([e25f86b](https://github.com/poolifier/poolifier/commit/e25f86b30763ea5c2e5fc6c0ef16818b7e4efe83)), closes [#2284](https://github.com/poolifier/poolifier/issues/2284)


### ✨ Polish

* npx -&gt; pnpm dlx where appropriates ([21b76dc](https://github.com/poolifier/poolifier/commit/21b76dc2ca538ea8691570e599b152d4d4dd50bd))


### 🧪 Tests

* fix error type expectation ([16196bc](https://github.com/poolifier/poolifier/commit/16196bc039fc80684b777cf4cd9e822e3293c339))


### 📚 Documentation

* **api.md:** add missing ToC entry ([989a71a](https://github.com/poolifier/poolifier/commit/989a71a5497bfeb445748022d241de083fa9d66b))
* **api.md:** document tasksStealingRatio tasks queue option ([453c646](https://github.com/poolifier/poolifier/commit/453c6467536356616003ea3666fd4d14ef539e26))
* publish documentation ([082fb4d](https://github.com/poolifier/poolifier/commit/082fb4db638f093fe284690eaf4764e0a2758184))


### 🤖 Automation

* **deps-dev:** bump @cspell/eslint-plugin from 8.10.4 to 8.11.0 ([ae8cecf](https://github.com/poolifier/poolifier/commit/ae8cecfc95719c815557f1d1b210d282dda350cd))
* **deps-dev:** bump @types/node ([e1436e8](https://github.com/poolifier/poolifier/commit/e1436e89c8a3a0d83cf82dcc835b4ef10b3e9738))
* **deps-dev:** bump husky from 9.0.11 to 9.1.0 ([#2474](https://github.com/poolifier/poolifier/issues/2474)) ([8b770d2](https://github.com/poolifier/poolifier/commit/8b770d22dba7dcb844c7aae2d16de414499ff9f6))
* **deps-dev:** bump prettier from 3.3.2 to 3.3.3 ([#2469](https://github.com/poolifier/poolifier/issues/2469)) ([ed09ef1](https://github.com/poolifier/poolifier/commit/ed09ef1d80a2ba11abf2e276c1c4b3c4081979c1))
* **deps-dev:** bump tatami-ng from 0.5.1 to 0.5.3 ([27ddec8](https://github.com/poolifier/poolifier/commit/27ddec8d142fab42db702118325d49ce0c1140cc))
* **deps:** bump poolifier ([01afcb2](https://github.com/poolifier/poolifier/commit/01afcb2142ddf51db4de08aa85ff36408e1d34ea))
* **deps:** bump poolifier ([f49f67f](https://github.com/poolifier/poolifier/commit/f49f67f853d84ab60a407f3bbaeea41c462bda83))
* **deps:** bump poolifier ([ac181f4](https://github.com/poolifier/poolifier/commit/ac181f447618a6ca7206d13fdc17acafed0cd472))
* **deps:** bump poolifier ([966953d](https://github.com/poolifier/poolifier/commit/966953ddd2798a4bb52e83fb054165e7cc2b2dca))
* **deps:** bump poolifier ([d67aa39](https://github.com/poolifier/poolifier/commit/d67aa393b66234b305638f02aec075ceea5053d9))
* **deps:** bump poolifier ([4763e8c](https://github.com/poolifier/poolifier/commit/4763e8cea8204ed4f1f4da9e14f27e83949a445c))
* **deps:** bump poolifier ([69b9ebc](https://github.com/poolifier/poolifier/commit/69b9ebc66743cc0fd14d0c13d547d72a8962e54a))
* **deps:** bump poolifier ([37645d7](https://github.com/poolifier/poolifier/commit/37645d7921f5d48c1731726430ec6b56cff9b472))
* **deps:** bump poolifier ([c63416f](https://github.com/poolifier/poolifier/commit/c63416f26d0ceb487f2efdc47ec029b069c3c9e1))
* **deps:** bump poolifier in /examples/typescript/http-client-pool ([d96a9d3](https://github.com/poolifier/poolifier/commit/d96a9d38c802923b762447e2d07b2679932ae687))
* **deps:** bump poolifier in /examples/typescript/smtp-client-pool ([af1cc0e](https://github.com/poolifier/poolifier/commit/af1cc0e16116ec360615a121cef2c25035e73ce5))

## [4.0.18](https://github.com/poolifier/poolifier/compare/v4.0.17...v4.0.18) (2024-07-11)


### 🐞 Bug Fixes

* null exception when a task errored ([ac5ee55](https://github.com/poolifier/poolifier/commit/ac5ee55ef0ad7dc29f3d0bc6906e2e127dc2e026))


### ✨ Polish

* **priority-queue:** cleanup intermediate variables namespace ([bb5d86b](https://github.com/poolifier/poolifier/commit/bb5d86b228984c83011f07de7b012f1fcd48fe0a))


### 🧪 Tests

* improve WorkerNode init coverage ([bcac180](https://github.com/poolifier/poolifier/commit/bcac1803a87e7cbb6fcbebd691a322d796266329))


### 📚 Documentation

* fix CHANGELOG.md formatting ([1823a63](https://github.com/poolifier/poolifier/commit/1823a63f7348cbe1a954b8d3a431bb8087cf8b76))
* flag WorkerChoiceStrategiesContext class as internal ([9eacd2e](https://github.com/poolifier/poolifier/commit/9eacd2e07943c40c0b984de621fc9542f959aed6))
* publish documentation ([62d0f6f](https://github.com/poolifier/poolifier/commit/62d0f6fe252439cf9a7d71c290a3f1a162aeb829))


### 🤖 Automation

* **deps-dev:** bump tatami-ng from 0.4.16 to 0.5.1 ([#2453](https://github.com/poolifier/poolifier/issues/2453)) ([d7b4ed8](https://github.com/poolifier/poolifier/commit/d7b4ed89bb9f65c94af724ec2de0de7f19bbdc64))

## [4.0.17](https://github.com/poolifier/poolifier/compare/v4.0.16...v4.0.17) (2024-07-07)

### ⚡ Performance

- optimize tasks queuing implementation ([097dea6](https://github.com/poolifier/poolifier/commit/097dea68fd73ac0d6f6db7b13c585bf8b6726418))

### ✨ Polish

- factor out fixed queue common code in an abstract class ([840270a](https://github.com/poolifier/poolifier/commit/840270a0f49c9d845f9b2850a36853e1d709f740))
- format code ([9183b88](https://github.com/poolifier/poolifier/commit/9183b8807bdac35067a22362216d1deadc16421f))
- move queueing code into its own directory ([c6dd1ae](https://github.com/poolifier/poolifier/commit/c6dd1aeb73ee5d5dd5bbfa9ebd9c4496a60f1252))
- refine queue full error message ([9008a96](https://github.com/poolifier/poolifier/commit/9008a9668154357ce942ec56caa95dfc3fc08238))
- remove duplicate code in fixed-queue.ts ([7a1c77f](https://github.com/poolifier/poolifier/commit/7a1c77f62bf4a16d3cd482d479e92e1cd4b1354b))

### 📚 Documentation

- generate documentation ([a7ee49b](https://github.com/poolifier/poolifier/commit/a7ee49b03e5a2ee6bd1a1b74a2fe3a2fb7c23404))

### 🤖 Automation

- **ci:** fix automated documentation publication at releasing ([147c01e](https://github.com/poolifier/poolifier/commit/147c01eadb3b951b84487c4328f553f95b16fb47))
- **deps-dev:** bump @cspell/eslint-plugin from 8.10.1 to 8.10.2 ([4f10a83](https://github.com/poolifier/poolifier/commit/4f10a833ef225ac7dbebf9faa16de9c89c8fdf5b))
- **deps-dev:** bump @types/node ([1d24d0e](https://github.com/poolifier/poolifier/commit/1d24d0e543ebbbb4b3582d29c726cd1621643ca2))
- **deps-dev:** bump @types/node ([ffa4f4f](https://github.com/poolifier/poolifier/commit/ffa4f4f21af0b1591c10c3e53aa929e94f825e99))
- **deps-dev:** bump @types/node ([1fe2514](https://github.com/poolifier/poolifier/commit/1fe2514362ede951510d751dac37e7c279a22ec1))
- **deps-dev:** bump @types/node ([e90a256](https://github.com/poolifier/poolifier/commit/e90a256eb79bc279127cb4021adf58f9fd300ed2))
- **deps-dev:** bump @types/node ([0bf1a17](https://github.com/poolifier/poolifier/commit/0bf1a17388ea8730fb01dc5cb50a8eccf9e18776))
- **deps-dev:** bump @types/node ([dd73d0c](https://github.com/poolifier/poolifier/commit/dd73d0c5c9a4e0bf9ba32dc167807356f0b4857d))
- **deps-dev:** bump @types/node ([2be2259](https://github.com/poolifier/poolifier/commit/2be2259b5dc04eb137210dead6a64dd4cac754b1))
- **deps-dev:** bump @types/node ([828a2e0](https://github.com/poolifier/poolifier/commit/828a2e030c8777b7fd5a342b693f9e75beb7b9cf))
- **deps-dev:** bump @types/node ([7109e5b](https://github.com/poolifier/poolifier/commit/7109e5b3b0a6d2e3f3391003be9539eb8fd8bd14))
- **deps-dev:** bump @types/node ([6f81d57](https://github.com/poolifier/poolifier/commit/6f81d5738358fa5cf67e28402823097c08594eb7))
- **deps-dev:** bump @types/node ([dc6b47a](https://github.com/poolifier/poolifier/commit/dc6b47a68c6c90b41cedde8e79d0c89709c47d87))
- **deps-dev:** bump @types/node from 20.14.9 to 20.14.10 ([4c07331](https://github.com/poolifier/poolifier/commit/4c073317e4ad123465ecfdc99491e0291d3fd23d))
- **deps:** bump poolifier ([9b11cba](https://github.com/poolifier/poolifier/commit/9b11cbaa8455a707c258312a650953eff5de0134))
- **deps:** bump poolifier ([4c39d13](https://github.com/poolifier/poolifier/commit/4c39d13d36114a267be20a173c60748c6ec5a781))
- **deps:** bump poolifier ([b0ad3bc](https://github.com/poolifier/poolifier/commit/b0ad3bc6f5ec8e41009b5e81a1fd8f7fe1c4d7a0))
- **deps:** bump poolifier ([aa6ea2c](https://github.com/poolifier/poolifier/commit/aa6ea2cc4d821059d32337b12c796c2fcfd85a67))
- **deps:** bump poolifier ([ec4d611](https://github.com/poolifier/poolifier/commit/ec4d611b0e5edab030049780ff9fbbcfc19ad8ee))
- **deps:** bump poolifier ([cc4e9f0](https://github.com/poolifier/poolifier/commit/cc4e9f0106040f64e56997a51ec5b0004964e789))
- **deps:** bump poolifier ([6e1b4de](https://github.com/poolifier/poolifier/commit/6e1b4deb9d36d5bf1f50f506683a11766cbe50de))
- **deps:** bump poolifier ([8e21198](https://github.com/poolifier/poolifier/commit/8e2119854c17a555b3d5eb003afca5ab46bc85bc))
- **deps:** bump poolifier in /examples/typescript/http-client-pool ([7961830](https://github.com/poolifier/poolifier/commit/796183039d0ad99114f0cff66513ac4165016678))
- **deps:** bump poolifier in /examples/typescript/smtp-client-pool ([475dc40](https://github.com/poolifier/poolifier/commit/475dc409159cc97c715d2706ba68dd088be4026b))

## [4.0.16](https://github.com/poolifier/poolifier/compare/v4.0.15...v4.0.16) (2024-07-05)

### 📚 Documentation

- generate documentation ([224d008](https://github.com/poolifier/poolifier/commit/224d008191f52fa20b93e1ba67919569f8d6e315))
- generate documentation ([627fc57](https://github.com/poolifier/poolifier/commit/627fc572465ba2113cbf3df6bd055c3242ecd0fe))
- refine PR template ([f5e9127](https://github.com/poolifier/poolifier/commit/f5e91274ea67f61521fadf0ccbafc6d00f5d3b87))
- refine PR template ([e95501c](https://github.com/poolifier/poolifier/commit/e95501c05febf08366d375218728d5778432c1de))
- refine README.md badges ([7169bda](https://github.com/poolifier/poolifier/commit/7169bda30538a5244b2598a4ef466c5687953ebd))

### ✨ Polish

- **ci:** cleanup GH actions ([c5db2d3](https://github.com/poolifier/poolifier/commit/c5db2d3ea50692486410eb1a33e5bb51d6d4181e))
- code reformatting ([fe6df28](https://github.com/poolifier/poolifier/commit/fe6df2852c1f0964cdffb0698461c9d66b1cf7ed))
- refine biome.js configuration ([1352ca7](https://github.com/poolifier/poolifier/commit/1352ca70c0b5c6b4ff3813b0c24354b5514b2796))
- silence linter ([a17b6fe](https://github.com/poolifier/poolifier/commit/a17b6fe6a9b7cde367fa1f1a0a89f6ee5db46ad6))

### 🤖 Automation

- **ci:** add autofix GH action ([14b39b9](https://github.com/poolifier/poolifier/commit/14b39b9c09ab382fa25dcb0d52c50b6d05a3affb))
- **ci:** do not cancel workflow in case of autofix failure ([177dbab](https://github.com/poolifier/poolifier/commit/177dbab8accac6267be8973103757de31f4a4c23))
- **ci:** fix autofix GH action ([e3a9678](https://github.com/poolifier/poolifier/commit/e3a9678311f735b7c951c5d72f26ef86c7beca9c))
- **ci:** fix autofix GH action ([0b7cbf7](https://github.com/poolifier/poolifier/commit/0b7cbf73dfdc8346132c002ba9c83fdafe286ee2))
- **ci:** fix eslint configuration ([c5d7f73](https://github.com/poolifier/poolifier/commit/c5d7f736e1e8c36a2c2d9cbe30e86d1d3ba863a1))
- **ci:** publish documentation at release ([3a83d94](https://github.com/poolifier/poolifier/commit/3a83d94cd44b504e3b9a3f3b15e9dec4f8c33d49))
- **ci:** refine autofix GH action ([8b7aa42](https://github.com/poolifier/poolifier/commit/8b7aa4204c27efd1dc699f7baea65b5262bd26b3))
- **ci:** refine autofix GH action ([8ab143b](https://github.com/poolifier/poolifier/commit/8ab143bb67ef7fb367d771c652cc44df70c9b625))
- **ci:** switch to release-please release manager ([4c7e68a](https://github.com/poolifier/poolifier/commit/4c7e68aa71533a8ef98296d2f50a2aac898d6b17))
- **deps-dev:** apply updates ([5c48a85](https://github.com/poolifier/poolifier/commit/5c48a8596b49dec06ec8995df4941ad63cc68f46))
- **deps-dev:** apply updates ([f94bb23](https://github.com/poolifier/poolifier/commit/f94bb23c8a460415f01bee2a34bf1e56b74236a8))
- **deps-dev:** apply updates ([1e98512](https://github.com/poolifier/poolifier/commit/1e9851233c950074ccbb5cd525fc0f4075e491d4))
- **deps-dev:** apply updates ([aaceda9](https://github.com/poolifier/poolifier/commit/aaceda9e4a134d9f8d3db37e349a18e7b2b1c303))
- **deps-dev:** apply updates ([3dcc95e](https://github.com/poolifier/poolifier/commit/3dcc95e54a6bfeb4b27460d60d3c90d27ac352dd))
- **deps-dev:** apply updates ([0aa0016](https://github.com/poolifier/poolifier/commit/0aa00166eaa9a8c9b505b4fa7fd5dc50d831b7ef))
- **deps-dev:** apply updates ([dea4237](https://github.com/poolifier/poolifier/commit/dea42379cfdbcf1c1c9800df7c097eab484ebc07))
- **deps-dev:** apply updates ([e06ce0e](https://github.com/poolifier/poolifier/commit/e06ce0ec82c8c076d6136f85f12101181d922612))
- **deps-dev:** apply updates ([80605a6](https://github.com/poolifier/poolifier/commit/80605a6c89c41c5b71e83385f615f85483987ea1))
- **deps-dev:** apply updates ([3b594fe](https://github.com/poolifier/poolifier/commit/3b594fe1b0f89d6665da2eb2ebdc14eb7628fe70))
- **deps-dev:** apply updates ([df01d9a](https://github.com/poolifier/poolifier/commit/df01d9a8a7053a4ff33e704cd5493f0a7bc4e2e7))
- **deps-dev:** apply updates ([a1b4a65](https://github.com/poolifier/poolifier/commit/a1b4a65143c0253b57fee18affd88a554122e955))
- **deps-dev:** apply updates ([31a42de](https://github.com/poolifier/poolifier/commit/31a42de7d691911759e12a673e5a2153f5558ed8))
- **deps-dev:** bump @cspell/eslint-plugin from 8.9.0 to 8.9.1 ([0b4d6a4](https://github.com/poolifier/poolifier/commit/0b4d6a4b0255f0172da50a9ba3989d21725027a5))
- **deps-dev:** bump eslint-plugin-jsdoc from 48.2.13 to 48.4.0 ([195a874](https://github.com/poolifier/poolifier/commit/195a874e9537a715e04b54e44c9a4eef04b1fefa))
- **deps-dev:** bump mocha from 10.4.0 to 10.5.0 ([b1b2093](https://github.com/poolifier/poolifier/commit/b1b20933105fb3c21f3d3825dc18a87501ad8275))
- **deps-dev:** bump mocha from 10.5.1 to 10.5.2 ([a4d1195](https://github.com/poolifier/poolifier/commit/a4d1195cd5b6d60f0d4424b32c638d304023e15e))
- **deps-dev:** bump neostandard from 0.7.2 to 0.8.0 ([7344812](https://github.com/poolifier/poolifier/commit/7344812ff30f82f3b7b88383eca5564c398d2de0))
- **deps-dev:** bump typedoc from 0.26.0 to 0.26.2 ([8004ea7](https://github.com/poolifier/poolifier/commit/8004ea76f77c3dee098569b37bc9dec9e82f8fe3))
- **deps-dev:** bump typescript ([fca1e52](https://github.com/poolifier/poolifier/commit/fca1e522f2df0e93e302e6278dc4725b2e28f561))
- **deps-dev:** bump typescript ([345d416](https://github.com/poolifier/poolifier/commit/345d416980bd3204398e730ca259d1755dcd0f64))
- **deps-dev:** bump typescript ([3aa8d66](https://github.com/poolifier/poolifier/commit/3aa8d6646706dd32bbd96795330f0a5365d52efa))
- **deps-dev:** bump typescript ([8837306](https://github.com/poolifier/poolifier/commit/8837306853d6b01efaf67bf69f129fc9ca47b071))
- **deps-dev:** bump typescript ([0b79799](https://github.com/poolifier/poolifier/commit/0b797997c9340aac75c7be6e5559b08076c387e7))
- **deps-dev:** bump typescript ([995d429](https://github.com/poolifier/poolifier/commit/995d429cce313177943d54e9c1f3e02a1cdc8c31))
- **deps-dev:** bump typescript ([2905914](https://github.com/poolifier/poolifier/commit/2905914e6e410cff2a1f8a75c8184abf701d7a16))
- **deps-dev:** bump typescript ([f2c2f1b](https://github.com/poolifier/poolifier/commit/f2c2f1b196b0cac64235304b5df4b24a97d09ffb))
- **deps-dev:** bump typescript ([37b0774](https://github.com/poolifier/poolifier/commit/37b07742956c3d25debda0048a60afd3659b547f))
- **deps-dev:** bump typescript ([f4a2509](https://github.com/poolifier/poolifier/commit/f4a2509b88456b0f6d16c8348c1e07470a94415f))
- **deps-dev:** bump typescript ([97bb99a](https://github.com/poolifier/poolifier/commit/97bb99ac1e28c87f59b75ea23a9c6643a8fba9c4))
- **deps:** bump poolifier ([5d5410e](https://github.com/poolifier/poolifier/commit/5d5410ec4203bc1ffa0a81fa52de85971916fed8))
- **deps:** bump poolifier ([177e46b](https://github.com/poolifier/poolifier/commit/177e46bb9cab33ad65c64b3dd5fd524bb0ac1eef))
- **deps:** bump poolifier ([580433b](https://github.com/poolifier/poolifier/commit/580433bc22585b6565a3404466a13e5babfd23fa))
- **deps:** bump poolifier ([a0583d4](https://github.com/poolifier/poolifier/commit/a0583d40e971f43f47b79fd049e99c069db8cac1))
- **deps:** bump poolifier ([161136f](https://github.com/poolifier/poolifier/commit/161136fe626ea7de93956b2e1e6228ffd6eba209))
- **deps:** bump poolifier ([70075ce](https://github.com/poolifier/poolifier/commit/70075ce9218f5a5a07c0decf0068775ae351c356))
- **deps:** bump poolifier ([d74c068](https://github.com/poolifier/poolifier/commit/d74c0684cb549b12897e79e31508b3cad5152456))
- **deps:** bump poolifier ([b8e4e7d](https://github.com/poolifier/poolifier/commit/b8e4e7dec768e992ba38e29dee0a0194eeb4fd50))
- **deps:** bump poolifier ([239d223](https://github.com/poolifier/poolifier/commit/239d22372bddd21106b22361038be2f3aae6e5de))
- **deps:** bump poolifier in /examples/typescript/http-client-pool ([1e6c12d](https://github.com/poolifier/poolifier/commit/1e6c12d988c87fdf1f95a2ffece8c1c76e49bcf3))
- **deps:** bump poolifier in /examples/typescript/smtp-client-pool ([4c29535](https://github.com/poolifier/poolifier/commit/4c29535a8e8669608907f0db799efa1c94f17421))
- **deps:** bump ws ([5ae7d26](https://github.com/poolifier/poolifier/commit/5ae7d26a61d9a13e49ccde6117c02d26f49d841d))
- **deps:** bump ws ([5fea98e](https://github.com/poolifier/poolifier/commit/5fea98eac18f518cb3c76dfed5e514e1aa27ecee))
- **deps:** bump ws ([cf6f83d](https://github.com/poolifier/poolifier/commit/cf6f83dd588e71b440f1454dd592c1e8029ada6d))

## [4.0.15] - 2024-06-20

### Fixed

- Fix priority queue dequeue() from the last prioritized bucket.

## [4.0.14] - 2024-06-12

### Changed

- Add mapExecute() helper to execute a task function on an iterable data's input.

## [4.0.13] - 2024-05-29

### Changed

- Optimize tasks queue implementation.
- Enable prioritized tasks queueing only when necessary.

## [4.0.12] - 2024-05-25

### Changed

- Optimize circular buffer implementation to store task execution measurements.

## [4.0.11] - 2024-05-21

### Changed

- Switch to optimized circular buffer implementation to store task execution measurements.

## [4.0.10] - 2024-05-20

### Fixed

- Ensure tasks stealing dynamic worker node is not destroyed on inactivity.

## [4.0.9] - 2024-05-19

### Changed

- Add ELU `utilization` statistics to pool information.

## [4.0.8] - 2024-05-15

### Fixed

- Fix default task function worker choice strategy and priority handling.

## [4.0.7] - 2024-05-13

### Changed

- Add ELU statistics to pool information.

## [4.0.6] - 2024-05-10

### Fixed

- Fix pools' `addTaskFunction()` type definition.

## [4.0.5] - 2024-05-09

### Fixed

- Avoid queued tasks redistribution on the errored worker node.

## [4.0.4] - 2024-05-08

### Fixed

- Disable `tasksStealingOnBackPressure` by default until performance issues under heavy load are sorted out.

## [4.0.3] - 2024-05-08

### Changed

- Optimize task(s) stealing by dequeuing task(s) from the last prioritized bucket.

## [4.0.2] - 2024-05-06

### Fixed

- Ensure poolifier worker task performance measurement requirements are synchronized with task function objects' worker choice strategies.

## [4.0.1] - 2024-05-02

### Fixed

- Ensure dynamic worker node are initialized with sensible worker node usage default values to avoid worker choice strategies biased decisions.
- Account for tasks wait time in task execution time computation in worker choice strategies to avoid biased decisions under load with several prioritized task functions and tasks queue enabled.

## [4.0.0] - 2024-04-30

### Changed

- Support per task function(s) priority and worker choice strategy definition via a task function object: `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy }`.
- Add priority queue based tasks queueing. One priority queue is divided into prioritized buckets to avoid queued tasks starvation under load.
- BREAKING CHANGE: `listTaskFunctionNames()` to `listTaskFunctionsProperties()` in pool and worker API returning registered task functions properties.
- BREAKING CHANGE: `strategy` field in pool information renamed to `defaultStrategy`.

### Fixed

- Ensure worker choice strategy options changes at runtime are propagated to poolifier workers.

## [3.1.30] - 2024-04-22

### Fixed

- Fix `transferList` argument type definition.

## [3.1.29] - 2024-04-02

### Fixed

- Fix possible race condition at worker node recreation on worker `error` and `exit` events.

## [3.1.28] - 2024-04-01

### Fixed

- Ensure the minimum number of workers on a started pool is guaranteed.

## [3.1.27] - 2024-03-27

### Fixed

- Fix publishing on JSR, take 4.

## [3.1.26] - 2024-03-27

### Fixed

- Fix publishing on JSR, take 3.

## [3.1.25] - 2024-03-27

### Fixed

- Fix publishing on JSR, take 2.

## [3.1.24] - 2024-03-27

### Fixed

- Fix publishing on JSR.

## [3.1.23] - 2024-03-27

### Changed

- Publish on JSR.

## [3.1.22] - 2024-03-15

### Fixed

- Fix pool event emitter registered callbacks removal at `destroy()`.

## [3.1.21] - 2024-02-22

### Fixed

- Fix null exception regression: [#1496](https://github.com/poolifier/poolifier/issues/1496).

## [3.1.20] - 2024-02-11

### Fixed

- Ensure `worker_threads` workers are unreferenced at termination.

## [3.1.19] - 2024-01-16

### Fixed

- Fix possible null exception at task finishing handling.

### Changed

- Optimize Deque implementation to improve tasks queueing performance.

## [3.1.18] - 2024-01-06

### Fixed

- Fix dynamic pool with minimum number of workers set to zero: [#1748](https://github.com/poolifier/poolifier/issues/1748).

## [3.1.17] - 2024-01-05

### Changed

- Improve performance by clean up unneeded condition checks on hot code paths.

## [3.1.16] - 2024-01-03

### Fixed

- Add missing type to TS type definitions.

## [3.1.15] - 2024-01-02

### Fixed

- Fix CommonJS support with TypeScript: [#1821](https://github.com/poolifier/poolifier/issues/1821).

## [3.1.15-0] - 2024-01-02

### Fixed

- Fix CommonJS support with TypeScript: [#1821](https://github.com/poolifier/poolifier/issues/1821).

## [3.1.14] - 2024-01-01

### Fixed

- Properly handle dynamic pool with zero minimum size.

## [3.1.13] - 2023-12-30

### Changed

- Reduce branching in several hot code paths.
- Use faster object cloning implementation.

## [3.1.12] - 2023-12-27

### Fixed

- Fix tasks redistribution triggers at pool destroying.

### Changed

- Switch TypeScript module resolution to Node16.

## [3.1.12-0] - 2023-12-27

### Fixed

- Fix tasks redistribution triggers at pool destroying.

## [3.1.11] - 2023-12-24

### Fixed

- Avoid worker node cross tasks stealing.
- Ensure only half the pool worker nodes can steal tasks.

## [3.1.10] - 2023-12-23

### Changed

- Avoid useless branching on pool type.

## [3.1.9] - 2023-12-22

### Changed

- Readd ThreadPoolOptions and ClusterPoolOptions TS type aliases to PoolOptions.

## [3.1.8] - 2023-12-21

### Fixed

- Fix default worker weight computation.
- Fix possible null exception at pool destroying.

## [3.1.7] - 2023-12-20

### Fixed

- Ensure worker choice strategies implementation wait for worker node readiness: [#1748](https://github.com/poolifier/poolifier/issues/1748).

## [3.1.6] - 2023-12-18

### Fixed

- Fix pool destroying with tasks queuing enabled.

## [3.1.5] - 2023-12-18

### Added

- Add queued tasks end timeout support to worker node termination.

## [3.1.4] - 2023-12-18

### Fixed

- Make more robust the fix for possible null exception at handling task execution response.

## [3.1.3] - 2023-12-17

### Fixed

- Fix possible null exception at handling task execution response.

## [3.1.2] - 2023-12-17

### Fixed

- Wait for queued tasks to end at worker node termination.

## [3.1.1] - 2023-12-16

### Fixed

- Fix pool options TS type definition.

## [3.1.0] - 2023-12-16

### Changed

- TypeScript breaking change: merge ThreadPoolOptions and ClusterPoolOptions types into PoolOptions type.

## [3.0.14] - 2023-12-13

### Fixed

- Fix possible null exception with worker_threads pools.

## [3.0.13] - 2023-12-12

### Fixed

- Ensure worker choice strategy wait for worker nodes readiness.

### Changed

- Remove infinite retries support in worker choice strategy to avoid configuration leading to possible infinite recursion or loop.

## [3.0.12] - 2023-12-12

### Changed

- Add infinite retries support in worker choice strategy.

## [3.0.11] - 2023-12-11

### Fixed

- Ensure pool asynchronous resource properly track tasks execution.

## [3.0.10] - 2023-12-08

### Changed

- Add a fastpath when tasks stealing or redistribution is impossible.

## [3.0.9] - 2023-11-26

### Fixed

- Remove all pool events listener at pool destroying.
- Remove all worker node events listener at worker node destroying.
- Fix worker node event emitter listeners handling memory leak at pool options runtime change.

## [3.0.8] - 2023-11-25

### Fixed

- Ensure continuous tasks stealing on idle start at worker node idling.

## [3.0.7] - 2023-11-24

### Changed

- Make continuous tasks stealing start at worker node idling.

## [3.0.6] - 2023-11-24

### Fixed

- Ensure pool statuses are checked at initialization, `start()` or `destroy()`.
- Ensure pool `ready` event can be emitted after several `start()/destroy()` cycles.

## [3.0.5] - 2023-10-27

### Fixed

- Ensure pool `ready` event can be emitted only once.

## [3.0.4] - 2023-10-20

### Changed

- Switch to Bencher for benchmarking: [https://bencher.dev/perf/poolifier](https://bencher.dev/perf/poolifier).
- Use builtin retry mechanism in worker choice strategies instead of custom one.

## [3.0.3] - 2023-10-19

### Fixed

- Avoid null exception at sending message to worker.
- Avoid null exception at checking worker node readiness.

## [3.0.2] - 2023-10-17

### Fixed

- Fix race condition at dynamic worker node task assignment and scheduled removal. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468) and [#1496](https://github.com/poolifier/poolifier/issues/1496).

## [3.0.1] - 2023-10-16

### Fixed

- Workaround possible race condition at work nodes array element removal and querying. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468).

### Changed

- Switch the worker node eventing code to `EventTarget` API.

## [3.0.0] - 2023-10-08

### Changed

- Remove Node.js 16.x.x (EOL) support.

## [2.7.5] - 2023-10-03

### Changed

- Use `EventEmitterAsyncResource` type from `@types/node` for pool event emitter. TypeScript users will need to update to latest `@types/node` version.

## [2.7.4] - 2023-09-25

### Fixed

- Fix source maps (bundler issue).

## [2.7.3] - 2023-09-24

### Changed

- Convert pool event emitter to event emitter async resource.

## [2.7.2] - 2023-09-23

### Changed

- Add source maps to npm package to ease debugging.

### Added

- Continuous benchmarking versus other worker pools: [https://poolifier.github.io/benchmark](https://poolifier.github.io/benchmark).

## [2.7.1] - 2023-09-20

### Fixed

- Ensure worker message listener used one time are removed after usage.

## [2.7.0] - 2023-09-19

### Fixed

- Fix task stealing related tasks queue options handling at runtime.

### Changed

- Rename `listTaskFunctions()` to `listTaskFunctionNames()` in pool and worker API.

### Added

- Add `hasTaskFunction()`, `addTaskFunction()`, `removeTaskFunction()`, `setDefaultTaskFunction()` methods to pool API: [PR #1148](https://github.com/poolifier/poolifier/pull/1148).
- Stricter worker constructor arguments validation.

## [2.6.45] - 2023-09-17

### Changed

- Disable publication on GitHub packages registry on release until authentication issue is fixed.

### Added

- Add `startWorkers` to pool options to whether start the minimum number of workers at pool initialization or not.
- Add `start()` method to pool API to start the minimum number of workers.
- Add `taskStealing` and `tasksStealingOnBackPressure` to tasks queue options to whether enable task stealing or not and whether enable tasks stealing under back pressure or not.
- Continuous internal benchmarking: [https://poolifier.github.io/benchmark-results/dev/bench](https://poolifier.github.io/benchmark-results/dev/bench).

## [2.6.44] - 2023-09-08

### Fixed

- Use a dedicated PAT to publish on GitHub packages registry.

### Added

- Publish on GitHub packages registry on release.

### Changed

- Switch from rome to biome: [PR #1128](https://github.com/poolifier/poolifier/pull/1128).

## [2.6.43] - 2023-09-08

### Added

- Publish on GitHub packages registry on release.

### Changed

- Switch from rome to biome: [PR #1128](https://github.com/poolifier/poolifier/pull/1128).

## [2.6.42] - 2023-09-06

### Changed

- Optimize hot code paths implementation: avoid unnecessary branching, add and use optimized helpers (min, max), use reduce() array helper, ...

## [2.6.41] - 2023-09-03

### Changed

- Optimize worker choice strategies implementation.

## [2.6.40] - 2023-09-01

### Fixed

- Do not pre-choose in WRR worker choice strategy to avoid bias.
- Avoid array out of bound in worker choice strategies after worker node removal.

## [2.6.39] - 2023-08-30

### Fixed

- Fix race condition in worker choice strategies at worker node info querying while not yet initialized.

## [2.6.38] - 2023-08-30

### Added

- Bundle typescript types declaration into one file.

### Changed

- Improve interleaved weighted round robin worker choice strategy implementation.

## [2.6.37] - 2023-08-28

### Fixed

- Ensure unused worker usage statistics are deleted at runtime.

### Changed

- Rename worker choice strategy options `choiceRetries` to `retries`.
- Avoid unnecessary branching in worker choice strategies.

## [2.6.36] - 2023-08-27

### Fixed

- Fix pool `execute()` arguments check.

### Changed

- Make continuous tasks stealing algorithm less aggressive.
- Fine tune tasks stealing algorithm under back pressure.

## [2.6.35] - 2023-08-25

### Fixed

- Don't account worker usage statistics for tasks that have failed.
- Fix pool information runtime and wait time median computation.

### Changed

- Update simple moving average implementation to use a circular buffer.
- Update simple moving median implementation to use a circular buffer.
- Account for stolen tasks in worker usage statistics and pool information.

### Added

- Continuous tasks stealing algorithm.

## [2.6.34] - 2023-08-24

### Fixes

- Avoid cascading tasks stealing under back pressure.

### Changed

- Add fastpath to queued tasks rescheduling.

## [2.6.33] - 2023-08-24

### Fixed

- Fix queued tasks rescheduling.

### Changed

- Rename tasks queue options `queueMaxSize` to `size`.

### Added

- Task stealing scheduling algorithm if tasks queueing is enabled.

## [2.6.32] - 2023-08-23

### Fixed

- Ensure no task can be executed when the pool is destroyed.

### Added

- Add `queueMaxSize` option to tasks queue options.
- Add O(1) deque implementation implemented with doubly linked list and use it for tasks queueing.
- Add tasks stealing algorithm when a worker node queue is back pressured if tasks queueing is enabled.

## [2.6.31] - 2023-08-20

### Fixed

- Fix worker choice strategy retries mechanism in some edge cases.

### Changed

- Make orthogonal worker choice strategies tasks distribution and created dynamic worker usage.
- Remove the experimental status of the `LEAST_ELU` worker choice strategy.

## [2.6.30] - 2023-08-19

### Fixed

- Ensure pool event `backPressure` is emitted.
- Ensure pool event `full` is emitted only once.
- Ensure worker node cannot be instantiated without proper arguments.

## [2.6.29] - 2023-08-18

### Fixed

- Fix race condition between readiness and task functions worker message handling at startup.
- Fix duplicate task function worker usage statistics computation per task function.
- Update task function worker usage statistics if and only if there's at least two different task functions.
- Fix race condition at task function worker usage executing task computation leading to negative value.

### Added

- Add back pressure detection on the worker node queue. Event `backPressure` is emitted when all worker node queues are full (worker node queue size >= poolMaxSize^2).
- Use back pressure detection in worker choice strategies.
- Add worker choice strategies retries mechanism if no worker is eligible.

## [2.6.28] - 2023-08-16

### Fixed

- Ensure pool workers are properly initialized.

### Added

- HTTP server pool examples: express-cluster, express-hybrid.

### Changed

- Remove now useless branching in worker hot code path.

## [2.6.27] - 2023-08-15

### Fixed

- Add `KillHandler` type definition to exported types.

### Added

- Add `destroy` event to pool API.

## [2.6.26] - 2023-08-15

### Added

- Add kill handler to worker options allowing to execute custom code when worker is killed.
- Add `listTaskFunctions()` method to pool API.
- SMTP client pool example: nodemailer.

## [2.6.25] - 2023-08-13

### Added

- HTTP server pool examples: fastify-cluster, fastify-hybrid.
- WebSocket server pool examples: ws-cluster, ws-hybrid.

## [2.6.24] - 2023-08-12

### Added

- Add array of transferable objects to the `execute()` method arguments.
- WebSocket server pool examples: ws-worker_threads.

## [2.6.23] - 2023-08-11

### Fixed

- Fix pool busyness semantic when tasks queueing is enabled: the pool is busy when the number of executing tasks on each worker has reached the maximum tasks concurrency per worker.

### Added

- HTTP client pool examples: fetch, node-fetch and axios with multiple task functions.
- HTTP server pool examples: express-worker_threads, fastify-worker_threads.

## [2.6.22] - 2023-08-10

### Fixed

- Add missing `types` field to package.json `exports`.

### Changed

- Structure markdown documentation (PR #811).

## [2.6.21] - 2023-08-03

### Changed

- Improve code documentation.
- Code refactoring and cleanup for better maintainability and readability.

## [2.6.20] - 2023-07-21

### Fixed

- Fix queued tasks redistribution on error task execution starvation.
- Ensure tasks queueing per worker condition is untangled from the pool busyness semantic.

### Changed

- Drastically reduce lookups by worker in the worker nodes.

## [2.6.19] - 2023-07-20

### Added

- Dedicated internal communication channel for worker_threads pools.

## [2.6.18] - 2023-07-19

### Changed

- Code refactoring and cleanup for better maintainability and readability. Bundle size is a bit smaller.

## [2.6.17] - 2023-07-16

### Added

- Add `listTaskFunctions()` method to worker API.

## [2.6.16] - 2023-07-12

### Fixed

- Fix pool startup detection.
- Fix worker task functions handling.

## [2.6.15] - 2023-07-11

### Added

- Take into account worker node readiness in worker choice strategies.

## [2.6.14] - 2023-07-10

### Fixed

- Fix task function statistics tracking.

## [2.6.13] - 2023-07-10

### Added

- Add per task function statistics tracking.
- Add public methods to manipulate the worker task functions at runtime.

## [2.6.12] - 2023-07-09

### Fixed

- Workaround import issue with `node:os` module in node 16.x.x.

## [2.6.11] - 2023-07-09

### Fixed

- Fix pool readiness semantic.

## [2.6.10] - 2023-07-08

### Fixed

- Ensure workers are not recreated on error at pool startup.

### Added

- Add `ready` and `strategy` fields to pool information.
- Add pool event `ready` to notify when the number of workers created in the pool has reached the maximum size expected and are ready.
- Add dynamic pool sizing checks.

## [2.6.9] - 2023-07-07

### Fixed

- Recreate the right worker type on uncaught exception.

### Added

- Add minimum and maximum to internal measurement statistics.
- Add `runTime` and `waitTime` to pool information.
- Check worker inactive time only on dynamic worker.

## [2.6.8] - 2023-07-03

### Fixed

- Brown paper bag release to fix version handling in pool information.

## [2.6.7] - 2023-07-03

### Fixed

- Ensure worker queued tasks at error are reassigned to other pool workers.

### Added

- Add pool `utilization` ratio to pool information.
- Add `version` to pool information.
- Add worker information to worker nodes.

## [2.6.6] - 2023-07-01

### Added

- Add safe helper `availableParallelism()` to help sizing the pool.

### Fixed

- Ensure message handler is only registered in worker.

## [2.6.5] - 2023-06-27

### Known issues

- Cluster pools tasks execution are not working by using ESM files extension: https://github.com/poolifier/poolifier/issues/782

### Fixed

- Artificial version bump to 2.6.5 to workaround publication issue.
- Ensure cluster pool `destroy()` gracefully shutdowns worker's server.
- Ensure pool event is emitted before task error promise rejection.
- Fix queued tasks count computation.

### Removed

- Remove unneeded worker_threads worker `MessageChannel` internal usage for IPC.

## [2.6.4] - 2023-06-27

### Known issues

- Cluster pools tasks execution are not working by using ESM files extension: https://github.com/poolifier/poolifier/issues/782

### Fixed

- Ensure cluster pool `destroy()` gracefully shutdowns worker's server.
- Ensure pool event is emitted before task error promise rejection.
- Fix queued tasks count computation.

### Removed

- Remove unneeded worker_threads worker `MessageChannel` internal usage for IPC.

## [2.6.3] - 2023-06-19

### Fixed

- Ensure no tasks are queued when trying to soft kill a dynamic worker.
- Update strategies internals after statistics computation.

### Changed

- Optimize O(1) queue implementation.

## [2.6.2] - 2023-06-12

### Fixed

- Fix new worker use after creation in dynamic pool given the current worker choice strategy.

## [2.6.1] - 2023-06-10

### Added

- Add worker choice strategy documentation: [README.md](./docs/worker-choice-strategies.md).

### Fixed

- Fix average statistics computation: ensure failed tasks are not accounted.

## [2.6.0] - 2023-06-09

### Added

- Add `LEAST_ELU` worker choice strategy (experimental).
- Add tasks ELU instead of runtime support to `FAIR_SHARE` worker choice strategy.

### Changed

- Refactor pool worker node usage internals.
- Breaking change: refactor worker choice strategy statistics requirements: the syntax of the worker choice strategy options has changed.
- Breaking change: pool information `info` property object fields have been renamed.

### Fixed

- Fix wait time accounting.
- Ensure worker choice strategy `LEAST_BUSY` accounts also tasks wait time.
- Ensure worker choice strategy `LEAST_USED` accounts also queued tasks.

## [2.5.4] - 2023-06-07

### Added

- Add Event Loop Utilization (ELU) statistics to worker tasks usage.

### Changed

- Compute statistics at the worker level only if needed.
- Add `worker_threads` options to thread pool options.

### Fixed

- Make the `LEAST_BUSY` strategy only relies on task runtime.

## [2.5.3] - 2023-06-04

### Changed

- Refine pool information content.
- Limit pool internals public exposure.

## [2.5.2] - 2023-06-02

### Added

- Add `taskError` pool event for task execution error.
- Add pool information `info` property to pool.
- Emit pool information on `busy` and `full` pool events.

## [2.5.1] - 2023-06-01

### Added

- Add pool option `restartWorkerOnError` to restart worker on uncaught error. Default to `true`.
- Add `error` pool event for uncaught worker error.

## [2.5.0] - 2023-05-31

### Added

- Switch pool event emitter to `EventEmitterAsyncResource`.
- Add tasks wait time accounting in per worker tasks usage.
- Add interleaved weighted round robin `INTERLEAVED_WEIGHTED_ROUND_ROBIN` worker choice strategy (experimental).

### Changed

- Renamed worker choice strategy `LESS_BUSY` to `LEAST_BUSY` and `LESS_USED` to `LEAST_USED`.

## [2.4.14] - 2023-05-09

### Fixed

- Ensure no undefined task runtime can land in the tasks history.
- Fix median computation implementation once again.

### Added

- Unit tests for median and queue implementations.

## [2.4.13] - 2023-05-08

### Fixed

- Fix worker choice strategy options validation.
- Fix fair share worker choice strategy internals update: ensure virtual task end timestamp is computed at task submission.

## [2.4.12] - 2023-05-06

### Added

- Support multiple task functions per worker.
- Add custom worker weights support to worker choice strategies options.

### Changed

- Use O(1) queue implementation for tasks queueing.

### Fixed

- Fix median computation implementation.
- Fix fair share worker choice strategy internals update.

## [2.4.11] - 2023-04-23

### Changed

- Optimize free worker finding in worker choice strategies.

## [2.4.10] - 2023-04-15

### Fixed

- Fix typescript type definition for task function: ensure the input data is optional.
- Fix typescript type definition for pool execute(): ensure the input data is optional.

## [2.4.9] - 2023-04-15

### Added

- Add tasks queue enablement runtime setter to pool.
- Add tasks queue options runtime setter to pool.
- Add worker choice strategy options runtime setter to pool.

### Changed

- Remove the tasks queuing experimental status.

### Fixed

- Fix task function type definition and validation.
- Fix worker choice strategy options handling.

## [2.4.8] - 2023-04-12

### Fixed

- Fix message between main worker and worker type definition for tasks.
- Fix code documentation.

## [2.4.7] - 2023-04-11

### Added

- Add worker tasks queue options to pool options.

### Fixed

- Fix missing documentation.

## [2.4.6] - 2023-04-10

### Fixed

- Ensure one task at a time is executed per worker with tasks queueing enabled.
- Properly count worker executing tasks with tasks queueing enabled.

## [2.4.5] - 2023-04-09

### Added

- Use monotonic high resolution timer for worker tasks runtime.
- Add worker tasks median runtime to statistics.
- Add worker tasks queue (experimental).

## [2.4.4] - 2023-04-07

### Added

- Add `PoolEvents` enumeration and `PoolEvent` type.

### Fixed

- Destroy worker only on alive check.

## [2.4.3] - 2023-04-07

### Fixed

- Fix typedoc generation with inheritance.

## [2.4.2] - 2023-04-06

### Added

- Add `full` event to dynamic pool.
- Keep worker choice strategy in memory for conditional reuse.

### Fixed

- Fix possible negative worker key at worker removal in worker choice strategies.

## [2.4.1] - 2023-04-05

### Changed

- Optimize worker choice strategy for dynamic pool.

### Fixed

- Ensure dynamic pool does not alter worker choice strategy expected behavior.

## [2.4.0] - 2023-04-04

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.
- Update benchmark versus external threads pools.
- Optimize tasks usage statistics requirements for worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-3] - 2023-04-04

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.
- Update benchmark versus external threads pools.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-2] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.
- Fix package publication with pnpm.

## [2.4.0-1] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.

## [2.4.0-0] - 2023-04-03

### Added

- Add `LESS_BUSY` worker choice strategy.

### Changed

- Optimize worker storage in pool.
- Optimize worker alive status check.
- BREAKING CHANGE: Rename worker choice strategy `LESS_RECENTLY_USED` to `LESS_USED`.
- Optimize `LESS_USED` worker choice strategy.

### Fixed

- Ensure trimmable characters are checked at pool initialization.
- Fix message id integer overflow.
- Fix pool worker removal in worker choice strategy internals.

## [2.3.10] - 2023-03-18

### Fixed

- Fix package.json `exports` syntax for ESM and CommonJS.

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-2] - 2023-03-18

### Fixed

- Fix package.json `exports` syntax for ESM and CommonJS.

## [2.3.10-1] - 2023-03-18

### Changed

- Permit SemVer pre-release publication.

## [2.3.10-0] - 2023-03-18

### Fixed

- Fix package.json `exports` syntax for ESM and CommonJS.

## [2.3.9] - 2023-03-18

### Changed

- Introduce ESM module support along with CommonJS one.

### Fixed

- Fix brown paper bag bug referencing the same object literal.

## [2.3.8] - 2023-03-18

### Changed

- Switch internal benchmarking code to benny.
- Switch to TypeScript 5.x.x.
- Switch rollup bundler plugins to core ones.
- Switch to TSDoc syntax.
- Enforce conventional commits.

### Fixed

- Fix random integer generator.
- Fix worker choice strategy pool type identification at initialization.

## [2.3.7] - 2022-10-23

### Changed

- Switch to open collective FOSS project funding platform.
- Switch to ts-standard linter configuration on TypeScript code.

### Fixed

- Fixed missing async on pool execute method.
- Fixed typing in TypeScript example.
- Fixed types in unit tests.

## [2.3.6] - 2022-10-22

### Changed

- Cleanup pool attributes and methods.
- Refine error types thrown.

### Fixed

- Fix continuous integration build on windows.
- Fix code coverage reporting by using c8 instead of nyc.

## [2.3.5] - 2022-10-21

### Changed

- Improve benchmarks: add IO intensive task workload, add task size option, integrate code into linter.
- Optimize tasks usage lookup implementation.

### Fixed

- Fix missed pool event emitter type export.
- Fix typedoc documentation generation.

## [2.3.4] - 2022-10-17

### Added

- Fully automate release process with release-it.

### Changed

- Optimize fair share task scheduling algorithm implementation.
- Update benchmark versus external pools results with latest version.

## [2.3.3] - 2022-10-15

### Added

- Add support for [cluster settings](https://nodejs.org/api/cluster.html#cluster_cluster_settings) in cluster pool options.

## [2.3.2] - 2022-10-14

### Changed

- Optimize fair share worker selection strategy implementation.

### Fixed

- Fix WRR worker selection strategy: ensure the condition triggering the round robin can be fulfilled.

## [2.3.1] - 2022-10-13

### Added

- Pool worker choice strategies:
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN` strategy based on weighted round robin scheduling algorithm using tasks execution time for now.
  - `WorkerChoiceStrategies.FAIR_SHARE` strategy based on fair share scheduling algorithm using tasks execution time for now.

## [2.2.2] - 2022-10-09

### Fixed

- Fixed `README.md` file.

## [2.2.1] - 2022-10-08

### Added

- Dynamic worker choice strategy change at runtime.

## [2.2.0] - 2022-01-05

### Breaking Changes

- Support only Node.js version 16.x.x for cluster pool: upstream cluster API have changed on that version.

## [2.1.0] - 2021-08-29

### Added

- Add an optional pool option `messageHandler` to `PoolOptions<Worker>` for registering a message handler callback on each worker.

### Breaking Changes

- `AbstractWorker` class `maxInactiveTime`, `killBehavior` and `async` attributes have been removed in favour of the same ones in the worker options `opts` public attribute.
- `AbstractWorker` class `lastTask` attribute have been renamed to `lastTaskTimestamp`.
- `AbstractWorker` class `interval` attribute have been renamed to `aliveInterval`.
- `AbstractWorker` class cannot be instantiated without specifying the `mainWorker` argument referencing the main worker.

## [2.0.2] - 2021-05-12

### Bug fixes

- Fix `busy` event emission on fixed pool type

## [2.0.1] - 2021-03-16

### Bug fixes

- Check if pool options are properly set.
- `busy` event is emitted on all pool types.

## [2.0.0] - 2021-03-01

### Bug fixes

- Now a thread/process by default is not deleted when the task submitted take more time than maxInactiveTime configured (issue #70).

### Breaking Changes

- `FullPool` event is now renamed to `busy`.
- `maxInactiveTime` on `ThreadWorker` default behavior is now changed, if you want to keep the old behavior set `killBehavior` to `KillBehaviors.HARD`.
  _Find more details on our JSDoc._

- `maxTasks` option on `FixedThreadPool` and `DynamicThreadPool` is now removed since is no more needed.

- We changed some internal structures, but you shouldn't be too affected by them as these are internal changes.

### Pool options types declaration merge

`FixedThreadPoolOptions` and `DynamicThreadPoolOptions` type declarations have been merged to `PoolOptions<Worker>`.

#### New `export` strategy

```js
// Before
const DynamicThreadPool = require('poolifier/lib/dynamic')
// After
const { DynamicThreadPool } = require('poolifier/lib/dynamic')
```

But you should always prefer just using

```js
const { DynamicThreadPool } = require('poolifier')
```

#### New type definitions for input data and response

For cluster worker and worker-thread pools, you can now only send and receive structured-cloneable data.  
_This is not a limitation by poolifier but Node.js._

#### Public property replacements

`numWorkers` property is now `numberOfWorkers`

#### Internal (protected) properties and methods renaming

These properties are not intended for end users

- `id` => `nextMessageId`

These methods are not intended for end users

- `_chooseWorker` => `chooseWorker`
- `_newWorker` => `createWorker`
- `_execute` => `internalExecute`
- `_chooseWorker` => `chooseWorker`
- `_checkAlive` => `checkAlive`
- `_run` => `run`
- `_runAsync` => `runAsync`

## [1.1.0] - 2020-05-21

### Added

- ThreadWorker support async functions as option
- Various external library patches

## [1.0.0] - 2020-01-24

### Added

- FixedThreadPool implementation
- DynamicThreadPool implementation
- WorkerThread implementation to improve developer experience
