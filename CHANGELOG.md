# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.17.5] - 2023-04-29

- add annotation `@DtoCreateApiResponse`, `@DtoUpdateApiResponse`, `@DtoPlainApiResponse`
- add annotation `@DtoCreateHidden`
- restore annotation `@DtoUpdateHidden`
- output NestJs pluralized model folders.
- add `@ApiProperty`.type for `@DtoCastType'
- support nested parentheses for validators, e.g.: @Matches(/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i)
- add annotation `@CustomValidator`
- always set `@ApiProperty`.required
- fix array: @Matches(/xxx/'', { each: true })


## [1.17.4] - 2023-03-04

- fix connect and create class names that get too many suffixes if `dtoSuffix` does not end with `dto` [#17][i17]

## [1.17.3] - 2023-02-22

### Fixed

- fix namespaced imports with `@DtoCastType` annotation [#16][pr16]

## [1.17.2] - 2023-02-10

### Fixes

- prisma imports for ConnectDTOs

## [1.17.0] - 2023-02-10

### Added

- support custom prisma-client import path [#15][pr15] (thanks to [konsti](https://github.com/konsti))
- `definiteAssignmentAssertion` flag to optionally add definite assignment assertion operator `!` to properties [#14][i14]
- support for compound unique inputs [#i8][i8], all ConnectDTOs now have proper swagger and class-validation decorators

### Fixed

- regular expression for class validators was also matching substrings

## [1.16.0] - 2023-01-06

### Added

- `@DtoCastType` annotation [#12][pr12] (thanks to [zackdotcomputer](https://github.com/zackdotcomputer))

## [1.15.0] - 2022-12-04

- updated dependencies [#11][pr11]

### Fixed

- `replaceAll` is not supported by Node.js < 15 [#10][i10]

## [1.14.0] - 2022-11-22

### Added

- add ApiProperty type and class validation to relation inputs [#6][i6]

### Fixed

- add `isArray: true` in ApiProperty decorator, if field is list
- build dist files with LF endings [#9][i9]

## [1.13.0] - 2022-09-14

### Added

- support for composite types (including nested class validation) [#2][i2]
- `@DtoTypeFullUpdate` annotation [#2][i2-comment]
- optionally auto-format output with prettier [#3][pr3] (thanks to [@Zyrakia](https://github.com/Zyrakia))

### Changed

- set `@ApiProperty({ required: false, nullable: true }` if field is optional
- add `{ each: true }` class-validator option if field is a list
- class-validator `@IsDateString()` for type `DateTime` and `@IsDecimal` for type `Decimal`

## [1.13.0-beta.1] - 2022-09-10

### Added

- `@DtoTypeFullUpdate` annotation [#2][i2]

## [1.12.2] - 2022-09-09

### Fixed

- optional fields can be `null` only `UpdateDTO`

## [1.12.1] - 2022-09-09

### Fixed

- optional fields can be `null` in `CreateDTO` and `UpdateDTO`

## [1.13.0-beta.0] - 2022-09-02

### Added

- support for composite types (including nested class validation) [#2][i2]

### Changed

- set `@ApiProperty({ required: false, nullable: true }` if field is optional
- add `{ each: true }` class-validator option if field is a list

## [1.12.0] - 2022-07-25

### Added

- `@DtoRelationIncludeId` annotation: relation IDs are omitted by default, but can be forced to be included in the DTOs

## [1.11.4] - 2022-05-17

### Fixed

- removed class validator `@IsJSON()` from `CreateDTO` and `UpdateDTO` for fields with `Json` type, because request body is already parsed and the respective property is not a JSON string anymore

## [1.11.3] - 2022-05-02

### Fixed

- if entity prefix/suffix is specified, relation input DTOs are named incorrectly (occurs if tags like @DtoRelationCanConnectOnCreate are used)

## [1.11.2] - 2022-04-20

### Fixed

- escape aposthrophe `'` with `\'`, otherwise string generation breaks

## [1.11.1] - 2022-04-14

### Fixed

- field with attribute `@default("")` resulted in empty `default` value: `@Apiproperty({ default: })'`
- parsed apiProperties were propagated to other DTOs

## [1.11.0] - 2022-03-31

### Added

- optionally add validation decorators from `class-validator`

## [1.10.0] - 2022-03-29

### Added

- config `outputType` to generate DTOs as `class` or as `interface`

## [1.9.1] - 2022-03-29

### Fixed

- missing import of `ApiProperty`

## [1.9.0] - 2022-03-29

### Added

- flag `flatResourceStructure` to flatten the subfolders if `outputToNestJsResourceStructure` is `true`
- flag `noDependencies` to output DTOs without any imports and decorators from external dependencies (useful to generate DTOs for frontend)
- `@example` annotation adds example to `@ApiProperty()`

## [1.8.1] - 2022-03-25

### Fixed

- missing `import` of `ApiProperty` if only type-format annotations

## [1.8.0] - 2022-03-25

### Added

- generate plain `DTO` classes (same as entity classes, but without relation fields)

### Changed

- default values are added to the `@ApiDecorator()` only in the `CreateDTO` and `UpdateDTO` classes

## [1.7.1] - 2022-03-22

### Fixed

- omit `@ApiProperty()` annotations for connect-dto classes

## [1.7.0] - 2022-03-18

### Added

- add default value (if any) to `@ApiProperty()`

## [1.6.2] - 2022-03-16

### Added

- process additional documentation tags to generate `@ApiProperty()` decorator
- translate prisma type to schema object type and format

## [1.4.1] - 2021-10-08

- upgrades prisma dependencies to their latest 3.x versions

### Fixed

- Generated code imports using \ instead of / ([#10](https://github.com/vegardit/prisma-generator-nestjs-dto/issues/10))

## [1.4.0] - 2021-09-24

- upgrades prisma dependencies to their latest 3.x versions

## [1.3.1] - 2021-09-24

- applies available minor and patch updates to dependencies

[i2]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/2
[i2-comment]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/2#issuecomment-1238855460
[pr3]: https://github.com/Brakebein/prisma-generator-nestjs-dto/pull/3
[i6]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/6
[i8]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/8
[i9]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/9
[i10]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/10
[pr11]: https://github.com/Brakebein/prisma-generator-nestjs-dto/pull/11
[pr12]: https://github.com/Brakebein/prisma-generator-nestjs-dto/pull/12
[i14]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/14
[pr15]: https://github.com/Brakebein/prisma-generator-nestjs-dto/pull/15
[pr16]: https://github.com/Brakebein/prisma-generator-nestjs-dto/pull/16
[i17]: https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/17
