# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.13.0-beta.1] - 2022-09-10

### Added

- `@DtoTypeFullUpdate` annotation [#2](https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/2#issuecomment-1238855460)

## [1.12.2] - 2022-09-09

### Fixed

- optional fields can be `null` only `UpdateDTO`

## [1.12.1] - 2022-09-09

### Fixed

- optional fields can be `null` in `CreateDTO` and `UpdateDTO`

## [1.13.0-beta.0] - 2022-09-02

### Added

- support for composite types (including nested class validation) #2

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

### Added

### Changed

### Fixed

- Generated code imports using \ instead of / ([#10](https://github.com/vegardit/prisma-generator-nestjs-dto/issues/10))

## [1.4.0] - 2021-09-24

- upgrades prisma dependencies to their latest 3.x versions

### Added

### Changed

### Fixed

## [1.3.1] - 2021-09-24

- applies available minor and patch updates to dependencies

### Added

### Changed

### Fixed
