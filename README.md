# Prisma Generator NestJS DTO

[![Release](https://badge.fury.io/js/%40brakebein%2Fprisma-generator-nestjs-dto.svg)](https://www.npmjs.com/package/@brakebein/prisma-generator-nestjs-dto)
[![License](https://img.shields.io/github/license/Brakebein/prisma-generator-nestjs-dto.svg?label=license)](#license)

1. [What is it?](#what-is-it)
1. [Usage](#usage)
1. [Annotations](#annotations)
1. [Example](#example)
1. [Principles](#principles)
1. [License](#license)

## What is it?

Generates `ConnectDTO`, `CreateDTO`, `UpdateDTO`, `DTO`, and `Entity` classes for models in your Prisma Schema. This is useful if you want to leverage [OpenAPI](https://docs.nestjs.com/openapi/introduction) in your [NestJS](https://nestjs.com/) application - but also helps with GraphQL resources as well). NestJS Swagger requires input parameters in [controllers to be described through classes](https://docs.nestjs.com/openapi/types-and-parameters) because it leverages TypeScript's emitted metadata and `Reflection` to generate models/components for the OpenAPI spec. It does the same for response models/components on your controller methods.

These classes can also be used with the built-in [ValidationPipe](https://docs.nestjs.com/techniques/validation#using-the-built-in-validationpipe) and [Serialization](https://docs.nestjs.com/techniques/serialization).

This is a fork of [@brakebein/prisma-generator-nestjs-dto](https://github.com/Brakebein/prisma-generator-nestjs-dto) and adds multiple features:

* enhance fields with additional schema information, e.g., description, to generate a `@ApiProperty()` decorator (see [Schema Object annotations](#schema-object-annotations))
* optionally add [validation decorators](#validation-decorators)
* support for composite types
* control output format with additional flags `flatResourceStructure`, `noDependencies`, and `outputType`
* optionally auto-format output with prettier

See [CHANGELOG](CHANGELOG.md) for all improvements and changes.

### ToDo

- [ ] fix `enum` handling

## Usage?

```sh
npm install --save-dev @brakebein/prisma-generator-nestjs-dto
```

```prisma
generator nestjsDto {
  provider                        = "prisma-generator-nestjs-dto"
  output                          = "../src/generated/nestjs-dto"
  outputToNestJsResourceStructure = "false"
  flatResourceStructure           = "false"
  exportRelationModifierClasses   = "true"
  reExport                        = "false"
  createDtoPrefix                 = "Create"
  updateDtoPrefix                 = "Update"
  dtoSuffix                       = "Dto"
  entityPrefix                    = ""
  entitySuffix                    = ""
  classValidation                 = "false"
  fileNamingStyle                 = "camel"
  noDependencies                  = "false"
  outputType                      = "class"
  definiteAssignmentAssertion     = "true"
  prettier                        = "false"
}
```

### Parameters

All parameters are optional.

- [`output`]: (default: `"../src/generated/nestjs-dto"`) - output path relative to your `schema.prisma` file
- [`outputToNestJsResourceStructure`]: (default: `"false"`) - writes `dto`s and `entities` to subfolders aligned with [NestJS CRUD generator](https://docs.nestjs.com/recipes/crud-generator). Resource module name is derived from lower-cased model name in `schema.prisma`
- [`flatResourceStructure`]: (default: `"false"`) - If `outputToNestJsResourceStructure` is `true`, subfolders `dto`s and `entities` are created within the resource folder. Setting this to `true` will flatten the hierarchy.
- [`exportRelationModifierClasses`]: (default: `"true"`) - Should extra classes generated for relationship field operations on DTOs be exported?
- [`reExport`]: (default: `false`) - Should an index.ts be created for every folder?
- [`createDtoPrefix`]: (default: `"Create"`) - phrase to prefix every `CreateDTO` class with
- [`updateDtoPrefix`]: (default: `"Update"`) - phrase to prefix every `UpdateDTO` class with
- [`dtoSuffix`]: (default: `"Dto"`) - phrase to suffix every `CreateDTO` and `UpdateDTO` class with
- [`entityPrefix`]: (default: `""`) - phrase to prefix every `Entity` class with
- [`entitySuffix`]: (default: `""`) - phrase to suffix every `Entity` class with
- [`fileNamingStyle`]: (default: `"camel"`) - How to name generated files. Valid choices are `"camel"`, `"pascal"`, `"kebab"` and `"snake"`.
- [`classValidation`]: (default: `"false"`) - Add validation decorators from `class-validator`. Not compatible with `noDependencies = "true"` and `outputType = "interface"`.
- [`noDependencies`]: (default: `"false"`) - Any imports and decorators that are specific to NestJS and Prisma are omitted, such that there are no references to external dependencies. This is useful if you want to generate appropriate DTOs for the frontend.
- [`outputType`]: (default: `"class"`) - Output the DTOs as `class` or as `interface`. `interface` should only be used to generate DTOs for the frontend.
- [`definiteAssignmentAssertion`]: (default: `"false"`) - Add a definite assignment assertion operator `!` to required fields, which is required if `strict` and/or `strictPropertyInitialization` is set `true` in your tsconfig.json's `compilerOptions`.
- [`prettier`]: (default: `"false"`) - Stylize output files with prettier.

## Annotations

Annotations provide additional information to help this generator understand your intentions. They are applied as [tripple slash comments](https://www.prisma.io/docs/concepts/components/prisma-schema#comments) to a field node in your Prisma Schema. You can apply multiple annotations to the same field.

```prisma
model Post {
  /// @DtoCreateOptional
  /// @DtoUpdateHidden
  createdAt   DateTime @default(now())
  /// @DtoCastType(DurationLike, luxon)
  timeUntilExpires Json?
}
```

- `@DtoReadOnly` - omits field in `CreateDTO` and `UpdateDTO`
- `@DtoEntityHidden` - omits field in `Entity`
- `@DtoCreateOptional` - adds field **optionally** to `CreateDTO` - useful for fields that would otherwise be omitted (e.g. `@id`, `@updatedAt`)
- `@DtoUpdateOptional` - adds field **optionally** to `UpdateDTO` - useful for fields that would otherwise be omitted (e.g. `@id`, `@updatedAt`)
- @DtoCreateHidden - omits field in `CreateDTO`
- @DtoUpdateHidden - omits field in `UpdateDTO`
- `@DtoCreateApiResponse` - generate `@ApiResponseProperty()` and ignore all other annotations in `CreateDTO`
- same for `DtoUpdateApiResponse` and `DtoPlainApiResponse`
- `@DtoRelationRequired` - marks relation **required** in `Entity` although it's optional in PrismaSchema - useful when you don't want (SQL) `ON DELETE CASCADE` behavior - but your logical data schema sees this relation as required  
  (**Note**: becomes obsolete once [referentialActions](https://github.com/prisma/prisma/issues/7816) are released and stable)
- `@DtoRelationCanCreateOnCreate` - adds [create](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#create-a-related-record) option on a relation field in the generated `CreateDTO` - useful when you want to allow to create related model instances
- `@DtoRelationCanConnectOnCreate` - adds [connect](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#connect-an-existing-record) option on a relation field in the generated `CreateDTO` - useful when you want/need to connect to an existing related instance
- `@DtoRelationCanCreateOnUpdate` - adds [create](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#create-a-related-record) option on a relation field in the generated `UpdateDTO` - useful when you want to allow to create related model instances
- `@DtoRelationCanConnectOnUpdate` - adds [connect](https://www.prisma.io/docs/concepts/components/prisma-client/relation-queries#connect-an-existing-record) option on a relation field in the generated `UpdateDTO` - useful when you want/need to connect to an existing related instance
- `@DtoRelationIncludeId` - include ID of a relation field that is otherwise omitted (use instead of `CanCreate`/`CanConnect` annotations, if you just want to pass the IDs)
- `@DtoTypeFullUpdate` - in the generated `UpdateDTO`, use the `CreateDTO` of the composite type to enforce a complete replacement the old values (see [#2](https://github.com/Brakebein/prisma-generator-nestjs-dto/issues/2#issuecomment-1238855460))
- `@DtoCastType(...)` - in all the generated entities, forces a provided type for this field. Especially useful if you need to cast Json fields at read/write. Note, you must provide at least one and may provide up to 3 arguments in the `(...)` with this annotation - the first is the name of the type to force for this field, the second and third can be used to add an `import` for that type at the top of the entity file. For example:
  - `@DtoCastType(MyType)` will cast the field as `MyType` but add no import
  - `@DtoCastType(MyType, some-package)` will cast the field as `MyType` and add `import {MyType} from "some-package"`
  - `@DtoCastType(MyType, ../types, default)` will cast and add `import MyType from "../types"`
  - `@DtoCastType(MyTypeInterface, ../types, MyType)` will cast as `MyTypeInterface` and add `import {MyType as MyTypeInterface} from "../types"`
- `@CustomValidator` - add custom validator, with an `import`. For example:
  - `@CustomValidator(MyValidator)` will generate a `@MyValidator()` on the field.
  - `@CustomValidator(MyValidator, ../package/name)` will generate a `@MyValidator()` on the field, and `import MyValidator from "../package/name"`.
  - `@CustomValidator(MyValidator, 'param1', 2, ../package/name)` will generate a `@MyValidator('param1', 2)` on the field, and `import MyValidator from "../package/name"`.

### Schema Object annotations

With `@nestjs/swagger`, you can generate an API specification from code.
Routes, request bodies, query parameters, etc., are annotated with special decorators.
Properties can be annotated with the `@ApiProperty()` decorator to add schema object information.
They are partially added at runtime, which will then include `type`, `nullable`, etc.
But additional information, such as description, need to be added manually.

If using a generator like this, any custom `@ApiProperty()` annotation would be overridden when updating the DTOs.
To enhance a field with additional schema information, add the schema property prefixed with `@` to the comment section above the field.

Currently, following schema properties are supported:

* `description`
* `minimum`
* `maximum`
* `exclusiveMinimum`
* `exclusiveMaximum`
* `minLength`
* `maxLength`
* `minItems`
* `maxItems`
* `example`

Additionally, special data types are inferred and annotated as well:

* `Int: { type: 'integer', format: 'int32' }`
* `BigInt: { type: 'integer', format: 'int64' }`
* `Float: { type: 'number', format: 'float' }`
* `Decimal: { type: 'number', format: 'double' }`
* `DateTime: { type: 'string', format: 'date-time' }`

#### Example

This example using `@description` and `@minimum` tags

```prisma
/// @description Number of reviews
/// @minimum 9
reviewCount Int     @default(0)
```

will generate `@ApiProperty()` decorator with `description` and `minimum` as properties as well as `type` and `format` to specify the data type.

```typescript
@ApiProperty({
  description: 'Number of reviews',
  minimum: 9,
  type: 'integer',
  format: 'int32',
})
reviewCount: number;
```

Default values are added in `CreateDTO` and `UpdateDTO`.
However, a field with a `@default()` attribute is hidden by default in `CreateDTO` and `UpdateDTO`,
hence requires `@DtoCreateOptional` and/or `@DtoUpdateOptional` to be present.

### Validation decorators

If `classValidation = "true"`, the generator will add validation decorators from [class-validator](https://github.com/typestack/class-validator) to each field of `CreateDTO` and `UpdateDTO` that can then be used in combination with the NestJS `ValidationPipe` (see [NestJS Auto-validation](https://docs.nestjs.com/techniques/validation#auto-validation)).

Some decorators will be inferred from the field's attributes.
If the field is optional, it will add `@IsOptional()`, otherwise `@IsNotEmpty()`.
If the field is a list, it will add `@IsArray()`.
Type validators are inferred from the field's type:

* `String` &rarr; `@IsString()`
* `Boolean` &rarr; `@IsBoolean()`
* `Int` &rarr; `@IsInt()`
* `BigInt` &rarr; `@IsInt()`
* `Float:` &rarr; `@IsNumber()`
* `Decimal:` &rarr; `@IsDecimal()`
* `DateTime` &rarr; `@IsDateString()`

All remaining [validation decorators](https://github.com/typestack/class-validator#validation-decorators) can be added in the comment/documentation section above the field.
The parentheses can be omitted if not passing a value.

#### Example

Prisma Schema

```prisma
/// @Contains('Product')
name        String   @db.VarChar(255)
reviewCount Int      @default(0)
/// @ArrayNotEmpty
tags        String[]
score       Float?
```

Generated output

```typescript
@IsNotEmpty()
@IsString()
@Contains('Product')
name: string;
@IsOptional()
@IsInt()
reviewCount?: number;
@IsNotEmpty()
@IsArray()
@ArrayNotEmpty()
tags: string[];
@IsOptional()
@IsNumber()
score?: number;
```

## Example

<details>
  <summary>Prisma Schema</summary>
  
```prisma
generator nestjsDto {
  provider = "prisma-generator-nestjs-dto"
  output = "../src"
  outputToNestJsResourceStructure = "true"
}

model Question {
  id          String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// @DtoReadOnly
  createdAt   DateTime @default(now())
  /// @DtoRelationRequired
  createdBy   User? @relation("CreatedQuestions", fields: [createdById], references: [id])
  createdById String? @db.Uuid
  updatedAt   DateTime @updatedAt
  /// @DtoRelationRequired
  updatedBy   User? @relation("UpdatedQuestions", fields: [updatedById], references: [id])
  updatedById String? @db.Uuid

  /// @DtoRelationRequired
  /// @DtoRelationCanConnectOnCreate
  category   Category? @relation(fields: [categoryId], references: [id])
  categoryId String?   @db.Uuid

  /// @DtoCreateOptional
  /// @DtoRelationCanCreateOnCreate
  /// @DtoRelationCanConnectOnCreate
  /// @DtoRelationCanCreateOnUpdate
  /// @DtoRelationCanConnectOnUpdate
  tags Tag[]

  title     String
  content   String
  responses Response[]
}
```

</details>

<details>
<summary>Generated results</summary>

```ts
// src/question/dto/connect-question.dto.ts
export class ConnectQuestionDto {
  id: string;
}
```

```ts
// src/question/dto/create-question.dto.ts
import { ApiExtraModels } from '@nestjs/swagger';
import { ConnectCategoryDto } from '../../category/dto/connect-category.dto';
import { CreateTagDto } from '../../tag/dto/create-tag.dto';
import { ConnectTagDto } from '../../tag/dto/connect-tag.dto';

export class CreateQuestionCategoryRelationInputDto {
  connect: ConnectCategoryDto;
}
export class CreateQuestionTagsRelationInputDto {
  create?: CreateTagDto[];
  connect?: ConnectTagDto[];
}

@ApiExtraModels(
  ConnectCategoryDto,
  CreateQuestionCategoryRelationInputDto,
  CreateTagDto,
  ConnectTagDto,
  CreateQuestionTagsRelationInputDto,
)
export class CreateQuestionDto {
  category: CreateQuestionCategoryRelationInputDto;
  tags?: CreateQuestionTagsRelationInputDto;
  title: string;
  content: string;
}
```

```ts
// src/question/dto/update-question.dto.ts
import { ApiExtraModels } from '@nestjs/swagger';
import { CreateTagDto } from '../../tag/dto/create-tag.dto';
import { ConnectTagDto } from '../../tag/dto/connect-tag.dto';

export class UpdateQuestionTagsRelationInputDto {
  create?: CreateTagDto[];
  connect?: ConnectTagDto[];
}

@ApiExtraModels(CreateTagDto, ConnectTagDto, UpdateQuestionTagsRelationInputDto)
export class UpdateQuestionDto {
  tags?: UpdateQuestionTagsRelationInputDto;
  title?: string;
  content?: string;
}
```

```ts
// src/question/entities/question.entity.ts
import { User } from '../../user/entities/user.entity';
import { Category } from '../../category/entities/category.entity';
import { Tag } from '../../tag/entities/tag.entity';
import { Response } from '../../response/entities/response.entity';

export class Question {
  id: string;
  createdAt: Date;
  createdBy?: User;
  createdById: string;
  updatedAt: Date;
  updatedBy?: User;
  updatedById: string;
  category?: Category;
  categoryId: string;
  tags?: Tag[];
  title: string;
  content: string;
  responses?: Response[];
}
```

</details>

## Principles

Generally we read field properties from the `DMMF.Field` information provided by `@prisma/generator-helper`. Since a few scenarios don't become quite clear from that, we also check for additional [annotations](#annotations) (or `decorators`) in a field's `documentation` (that is anything provided as a [tripple slash comments](https://www.prisma.io/docs/concepts/components/prisma-schema#comments) for that field in your `prisma.schema`).

Initially, we wanted `DTO` classes to `implement Prisma.<ModelName><(Create|Update)>Input` but that turned out to conflict with **required** relation fields.

### ConnectDTO

This kind of DTO represents the structure of input-data to expect from 'outside' (e.g. REST API consumer) when attempting to `connect` to a model through a relation field.

A `Model`s `ConnectDTO` class is composed from a unique'd list of `isId` and `isUnique` scalar fields. If the `ConnectDTO` class has exactly one property, the property is marked as required. If there are more than one properties, all properties are optional (since setting a single one of them is already sufficient for a unique query) - you must however specify at least one property.

`ConnectDTO`s are used for relation fields in `CreateDTO`s and `UpdateDTO`s.

### CreateDTO

This kind of DTO represents the structure of input-data to expect from 'outside' (e.g. REST API consumer) when attempting to `create` a new instance of a `Model`.
Typically the requirements for database schema differ from what we want to allow users to do.
As an example (and this is the opinion represented in this generator), we don't think that relation scalar fields should be exposed to users for `create`, `update`, or `delete` activities (btw. TypeScript types generated in PrismaClient exclude these fields as well). If however, your schema defines a required relation, creating an entity of that Model would become quite difficult without the relation data.
In some cases you can derive information regarding related instances from context (e.g. HTTP path on the rest endpoint `/api/post/:postid/comment` to create a `Comment` with relation to a `Post`). For all other cases, we have the

- `@DtoRelationCanCreateOnCreate`
- `@DtoRelationCanConnectOnCreate`
- `@DtoRelationCanCreateOnUpdate`
- `@DtoRelationCanConnectOnUpdate`

[annotations](#annotations) that generate corresponding input properties on `CreateDTO` and `UpdateDTO` (optional or required - depending on the nature of the relation).

When generating a `Model`s `CreateDTO` class, field that meet any of the following conditions are omitted (**order matters**):

- `isReadOnly` OR is annotated with `@DtoReadOnly` (_Note:_ this apparently includes relation scalar fields)
- field represents a relation (`field.kind === 'object'`) and is not annotated with `@DtoRelationCanCreateOnCreate` or `@DtoRelationCanConnectOnCreate`
- field is a [relation scalar](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/#annotated-relation-fields-and-relation-scalar-fields)
- field is not annotated with `@DtoCreateOptional` AND
  - `isId && hasDefaultValue` (id fields are not supposed to be provided by the user)
  - `isUpdatedAt` ([Prisma](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#updatedat) will inject value)
  - `isRequired && hasDefaultValue` (for schema-required fields that fallback to a default value when empty. Think: `createdAt` timestamps with `@default(now())` (see [now()](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#now)))

### UpdateDTO

When generating a `Model`s `UpdateDTO` class, field that meet any of the following conditions are omitted (**order matters**):

- field is annotated with `@DtoUpdateOptional`
- `isReadOnly` OR is annotated with `@DtoReadOnly` (_Note:_ this apparently includes relation scalar fields)
- `isId` (id fields are not supposed to be updated by the user)
- field represents a relation (`field.kind === 'object'`) and is not annotated with `@DtoRelationCanCreateOnUpdate` or `@DtoRelationCanConnectOnUpdate`
- field is a [relation scalar](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/#annotated-relation-fields-and-relation-scalar-fields)
- field is not annotated with `@DtoUpdateOptional` AND
  - `isId` (id fields are not supposed to be updated by the user)
  - `isUpdatedAt` ([Prisma](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#updatedat) will inject value)
  - `isRequired && hasDefaultValue` (for schema-required fields that fallback to a default value when empty. Think: `createdAt` timestamps with `@default(now())` (see [now()](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#now)))

### Entity

When generating a `Model`s `Entity` class, only fields annotated with `@DtoEntityHidden` are omitted.
All other fields are only manipulated regarding their `isRequired` and `isNullable` flags.

By default, every scalar field in an entity is `required` meaning it doesn't get the TypeScript "optional member flag" `?` next to it's name. Fields that are marked as optional in PrismaSchema are treated as `nullable` - meaning their TypeScript type is a union of `field.type` and `null` (e.g. `string | null`).

Relation and [relation scalar](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/#annotated-relation-fields-and-relation-scalar-fields) fields are treated differently. If you don't specifically `include` a relation in your query, those fields will not exist in the response.

- every relation field is always optional (`isRequired = false`)
- relations are nullable except when
  - the relation field is a one-to-many or many-to-many (i.e. list) type (would return empty array if no related records found)
  - the relation was originally flagged as required (`isRequired = true`)
  - the relation field is annotated with `@DtoRelationRequired` (do this when you mark a relation as optional in PrismaSchema because you don't want (SQL) `ON DELETE CASCADE` behavior - but your logical data schema sees this relation as required)
- default values are <ins>not</ins> added to the `@ApiProperty()` decorator

### DTO

The plain `DTO` class is almost the same as `Entity` with the difference that all relation fields are omitted.
This is useful if your response is the plain entity without any (optional) relations.

## License

All files are released under the [Apache License 2.0](https://github.com/Brakebein/prisma-generator-nestjs-dto/blob/master/LICENSE).
