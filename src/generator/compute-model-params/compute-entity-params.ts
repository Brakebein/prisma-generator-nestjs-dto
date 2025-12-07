import path from 'node:path';
import slash from 'slash';
import { DTO_ENTITY_HIDDEN, DTO_RELATION_REQUIRED } from '../annotations';
import {
  isAnnotatedWith,
  isRelation,
  isRequired,
  isType,
} from '../field-classifiers';
import {
  getRelationScalars,
  getRelativePath,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  zipImportStatementParams,
} from '../helpers';

import type { DMMF } from '@prisma/generator-helper';
import { PrismaScalarToFormat, parseApiProperty } from '../api-decorator';
import type { TemplateHelpers } from '../template-helpers';
import type {
  EntityParams,
  ImportStatementParams,
  Model,
  ParsedField,
} from '../types';
import { IApiProperty } from '../types';

interface ComputeEntityParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
}
export const computeEntityParams = ({
  model,
  allModels,
  templateHelpers,
}: ComputeEntityParamsParam): EntityParams => {
  let hasApiProperty = false;
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<DMMF.Field> = {
      isRequired: true,
      isNullable: !field.isRequired,
    };
    const decorators: { apiProperties?: IApiProperty[] } = {};

    if (isAnnotatedWith(field, DTO_ENTITY_HIDDEN)) return result;

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

        const importName = templateHelpers.plainDtoName(field.type);
        const importFrom = slash(
          `${getRelativePath(
            model.output.entity,
            modelToImportFrom.output.dto,
          )}${path.sep}${templateHelpers.plainDtoFilename(field.type)}`,
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

    // relation fields are never required in an entity.
    // they can however be `selected` and thus might optionally be present in the
    // response from PrismaClient
    if (isRelation(field)) {
      overrides.isRequired = isAnnotatedWith(field, DTO_RELATION_REQUIRED);
      overrides.isNullable = field.isList
        ? false
        : field.isRequired
        ? false
        : !isAnnotatedWith(field, DTO_RELATION_REQUIRED);

      // don't try to import the class we're preparing params for
      if (field.type !== model.name) {
        const modelToImportFrom = allModels.find(
          ({ name }) => name === field.type,
        ) as Model | undefined;

        if (!modelToImportFrom)
          throw new Error(
            `related model '${field.type}' for '${model.name}.${field.name}' not found`,
          );

        const importName = templateHelpers.entityName(field.type);
        const importFrom = slash(
          `${getRelativePath(
            model.output.entity,
            modelToImportFrom.output.entity,
          )}${path.sep}${templateHelpers.entityFilename(field.type)}`,
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

    if (relationScalarFieldNames.includes(name)) {
      const { [name]: relationNames } = relationScalarFields;
      const isAnyRelationRequired = relationNames.some((relationFieldName) => {
        const relationField = model.fields.find(
          (anyField) => anyField.name === relationFieldName,
        );
        if (!relationField) return false;

        return (
          isRequired(relationField) ||
          isAnnotatedWith(relationField, DTO_RELATION_REQUIRED)
        );
      });

      overrides.isRequired = true;
      overrides.isNullable = !isAnyRelationRequired;
    }

    if (!templateHelpers.config.noDependencies) {
      decorators.apiProperties = parseApiProperty(
        {
          ...field,
          isRequired: field.isRequired,
          isNullable: !field.isRequired,
        },
        { default: false },
      );

      const scalarFormat = PrismaScalarToFormat[field.type];
      if (!scalarFormat && field.type != 'Json') {
        decorators.apiProperties.push({
          name: 'type',
          value: ['String', 'Boolean'].includes(field.type)
            ? field.type
            : `() => ${field.type}`,
          noEncapsulation: true,
        });

        if (
          !['String', 'Json', 'Boolean'].includes(field.type) &&
          field.kind !== 'enum'
        ) {
          decorators.apiProperties.push({
            name: 'type_decorator',
            value: field.type,
            noEncapsulation: true,
          });
          imports.unshift({ from: 'class-transformer', destruct: ['Type'] });
        }
      }
      if (decorators.apiProperties.length) hasApiProperty = true;
    }

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'Float';
    }

    return [...result, mapDMMFToParsedField(field, overrides, decorators)];
  }, [] as ParsedField[]);

  if (apiExtraModels.length || hasApiProperty) {
    const destruct = [];
    if (apiExtraModels.length) destruct.push('ApiExtraModels');
    if (hasApiProperty) destruct.push('ApiProperty');
    imports.unshift({ from: '@nestjs/swagger', destruct });
  }

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers.config.prismaClientImportPath,
  );

  imports.unshift({
    from: 'class-transformer',
    destruct: ['Expose'],
  });

  return {
    model,
    fields,
    imports: zipImportStatementParams([...importPrismaClient, ...imports]),
    apiExtraModels,
  };
};
