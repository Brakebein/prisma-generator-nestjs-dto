import path from 'node:path';
import slash from 'slash';
import {
  DTO_CREATE_API_RESP,
  DTO_CREATE_HIDDEN,
  DTO_CREATE_OPTIONAL,
  DTO_RELATION_CAN_CONNECT_ON_CREATE,
  DTO_RELATION_CAN_CREATE_ON_CREATE,
  DTO_RELATION_CAN_UPDATE_ON_UPDATE,
  DTO_RELATION_INCLUDE_ID,
  DTO_RELATION_MODIFIERS_ON_CREATE,
  DTO_RELATION_REQUIRED,
} from '../annotations';
import {
  isAnnotatedWith,
  isAnnotatedWithOneOf,
  isIdWithDefaultValue,
  isReadOnly,
  isRelation,
  isRequiredWithDefaultValue,
  isType,
  isUpdatedAt,
} from '../field-classifiers';
import {
  concatIntoArray,
  concatUniqueIntoArray,
  generateRelationInput,
  getRelationScalars,
  getRelativePath,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  zipImportStatementParams,
} from '../helpers';

import type { DMMF } from '@prisma/generator-helper';
import { parseApiProperty } from '../api-decorator';
import { parseClassValidators } from '../class-validator';
import type { TemplateHelpers } from '../template-helpers';
import {
  CreateDtoParams,
  IApiProperty,
  IClassValidator,
  ImportStatementParams,
  Model,
  ParsedField,
} from '../types';

interface ComputeCreateDtoParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
}
export const computeCreateDtoParams = ({
  model,
  allModels,
  templateHelpers,
}: ComputeCreateDtoParamsParam): CreateDtoParams => {
  let hasApiProperty = false;
  let hasApiRespProperty = false;
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const extraClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<DMMF.Field> = {
      createApiResp: false,
    };
    const decorators: {
      apiProperties?: IApiProperty[];
      classValidators?: IClassValidator[];
    } = {};

    if (
      isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      field.isReadOnly = false;

    if (isAnnotatedWith(field, DTO_CREATE_HIDDEN)) return result;
    if (isReadOnly(field)) return result;
    if (isRelation(field)) {
      if (!isAnnotatedWithOneOf(field, DTO_RELATION_MODIFIERS_ON_CREATE)) {
        return result;
      }
      const relationInputType = generateRelationInput({
        field,
        model,
        allModels,
        templateHelpers,
        preAndSuffixClassName: templateHelpers.createDtoName,
        canCreateAnnotation: DTO_RELATION_CAN_CREATE_ON_CREATE,
        canConnectAnnotation: DTO_RELATION_CAN_CONNECT_ON_CREATE,
        canUpdateAnnotation: DTO_RELATION_CAN_UPDATE_ON_UPDATE,
      });

      if (relationInputType.imports.length > 1) {
        // Create and Connect
        const isDtoRelationRequired = isAnnotatedWith(
          field,
          DTO_RELATION_REQUIRED,
        );
        if (isDtoRelationRequired) overrides.isRequired = true;

        // list fields can not be required
        // TODO maybe throw an error if `isDtoRelationRequired` and `isList`
        if (field.isList) overrides.isRequired = false;

        overrides.type = relationInputType.type;
        // since relation input field types are translated to something like { connect: Foo[] }, the field type itself is not a list anymore.
        // You provide list input in the nested `connect` or `create` properties.

        concatIntoArray(relationInputType.imports, imports);
        concatIntoArray(relationInputType.generatedClasses, extraClasses);
        if (!templateHelpers.config.noDependencies)
          concatIntoArray(relationInputType.apiExtraModels, apiExtraModels);
        concatUniqueIntoArray(
          relationInputType.classValidators,
          classValidators,
          'name',
        );
      } else {
        const type = relationInputType.classValidators.find(
          (cv) => cv.name === 'Type',
        );
        if (type && type.value) {
          overrides.type = type.value;

          field.documentation += `\n%${type.value.replace('() => ', '')}%`;
        }

        concatIntoArray(relationInputType.imports, imports);
      }
    }

    if (
      !isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      return result;

    // fields annotated with @DtoReadOnly are filtered out before this
    // so this safely allows to mark fields that are required in Prisma Schema
    // as **not** required in CreateDTO
    const isDtoOptional = isAnnotatedWith(field, DTO_CREATE_OPTIONAL);

    if (!isDtoOptional) {
      if (isIdWithDefaultValue(field)) return result;
      if (isUpdatedAt(field)) return result;
      if (isRequiredWithDefaultValue(field)) return result;
    }
    if (isDtoOptional) {
      overrides.isRequired = false;
    }

    if (isType(field)) {
      // don't try to import the class we're preparing params for
      if (field.type !== model.name) {
        const modelToImportFrom = allModels.find(
          ({ name }) => name === field.type,
        );

        if (!modelToImportFrom)
          throw new Error(
            `related type '${field.type}' for '${model.name}.${field.name}' not found`,
          );

        const importName = templateHelpers.createDtoName(field.type);
        const importFrom = slash(
          `${getRelativePath(model.output.dto, modelToImportFrom.output.dto)}${
            path.sep
          }${templateHelpers.createDtoFilename(field.type)}`,
        );

        // don't double-import the same thing
        // TODO should check for match on any import name ( - no matter where from)
        if (
          !imports.some(
            (item) =>
              Array.isArray(item.destruct) &&
              item.destruct.includes(importName) &&
              item.from === importFrom,
          )
        ) {
          imports.push({
            destruct: [importName],
            from: importFrom,
          });
        }
      }
    }

    if (templateHelpers.config.classValidation) {
      decorators.classValidators = parseClassValidators(
        {
          ...field,
          ...overrides,
        },
        overrides.type?.replace('() =>', '') || templateHelpers.createDtoName,
      );
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!templateHelpers.config.noDependencies) {
      overrides.createApiResp = isAnnotatedWith(field, DTO_CREATE_API_RESP);
      hasApiRespProperty = hasApiRespProperty || overrides.createApiResp;
      decorators.apiProperties = parseApiProperty(field, {
        type: !overrides.type,
      });
      if (
        field.isList &&
        !decorators.apiProperties.find((p) => p.name === 'isArray')
      ) {
        decorators.apiProperties.push({
          name: 'isArray',
          value: 'true',
        });
      }
      if (overrides.type)
        decorators.apiProperties.push({
          name: 'type',
          value: overrides.type,
          noEncapsulation: true,
        });
      if (decorators.apiProperties.length) hasApiProperty = true;
    }

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'Float';
    }

    return [...result, mapDMMFToParsedField(field, overrides, decorators)];
  }, [] as ParsedField[]);

  if (apiExtraModels.length || hasApiProperty || hasApiRespProperty) {
    const destruct = [];
    if (apiExtraModels.length) destruct.push('ApiExtraModels');
    if (hasApiProperty) destruct.push('ApiProperty');
    if (hasApiRespProperty) destruct.push('ApiResponseProperty');
    imports.unshift({ from: '@nestjs/swagger', destruct });
  }

  if (classValidators.length) {
    if (classValidators.find((cv) => cv.name === 'Type')) {
      imports.unshift({
        from: 'class-transformer',
        destruct: ['Type'],
      });
    }
    imports.unshift({
      from: 'class-validator',
      destruct: classValidators
        .filter((cv) => cv.name !== 'Type')
        .map((v) => v.name)
        .sort(),
    });
  }

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers.config.prismaClientImportPath,
  );

  return {
    model,
    fields,
    imports: zipImportStatementParams([...importPrismaClient, ...imports]),
    extraClasses,
    apiExtraModels,
  };
};
