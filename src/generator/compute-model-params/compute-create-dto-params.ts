import slash from 'slash';
import path from 'node:path';
import {
  DTO_API_HIDDEN,
  DTO_OVERRIDE_API_PROPERTY_TYPE,
  DTO_CAST_TYPE,
  DTO_CREATE_HIDDEN,
  DTO_CREATE_OPTIONAL,
  DTO_CREATE_REQUIRED,
  DTO_CREATE_VALIDATE_IF,
  DTO_OVERRIDE_TYPE,
  DTO_RELATION_CAN_CONNECT_ON_CREATE,
  DTO_RELATION_CAN_CREATE_ON_CREATE,
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
  makeCustomImports,
  makeImportsFromPrismaClient,
  mapDMMFToParsedField,
  zipImportStatementParams,
} from '../helpers';
import type { TemplateHelpers } from '../template-helpers';
import type {
  Model,
  CreateDtoParams,
  ImportStatementParams,
  ParsedField,
  IClassValidator,
  IDecorators,
} from '../types';
import {
  makeImportsFromNestjsSwagger,
  parseApiProperty,
} from '../api-decorator';
import {
  makeImportsFromClassValidator,
  parseClassValidators,
} from '../class-validator';

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
  const imports: ImportStatementParams[] = [];
  const apiExtraModels: string[] = [];
  const extraClasses: string[] = [];
  const classValidators: IClassValidator[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<ParsedField> = {};
    const decorators: IDecorators = {};

    if (
      isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      field.isReadOnly = false;

    if (isReadOnly(field)) return result;
    if (isAnnotatedWith(field, DTO_CREATE_HIDDEN)) return result;
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
      });

      const isDtoRelationRequired = isAnnotatedWith(
        field,
        DTO_RELATION_REQUIRED,
      );
      if (isDtoRelationRequired) overrides.isRequired = true;

      // list fields can not be required
      // TODO maybe throw an error if `isDtoRelationRequired` and `isList`
      if (field.isList) overrides.isRequired = false;

      overrides.type = relationInputType.type;
      overrides.pureType = true;
      // since relation input field types are translated to something like { connect: Foo[] }, the field type itself is not a list anymore.
      // You provide list input in the nested `connect` or `create` properties.
      overrides.isList = false;
      overrides.isNullable = false;

      concatIntoArray(relationInputType.imports, imports);
      concatIntoArray(relationInputType.generatedClasses, extraClasses);
      if (!templateHelpers.config.noDependencies)
        concatIntoArray(relationInputType.apiExtraModels, apiExtraModels);
      concatUniqueIntoArray(
        relationInputType.classValidators,
        classValidators,
        'name',
      );
    }

    if (
      !isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      return result;

    // fields annotated with @DtoReadOnly are filtered out before this
    // so this safely allows to mark fields that are required in Prisma Schema
    // as **not** required in CreateDTO
    const isDtoOptional = isAnnotatedWithOneOf(field, [
      DTO_CREATE_OPTIONAL,
      DTO_CREATE_REQUIRED,
    ]);

    if (!isDtoOptional) {
      if (isIdWithDefaultValue(field)) return result;
      if (isUpdatedAt(field)) return result;
      if (isRequiredWithDefaultValue(field)) {
        if (templateHelpers.config.showDefaultValues)
          overrides.isRequired = false;
        else return result;
      }
    }
    if (isDtoOptional) {
      overrides.isRequired = false;
    }

    if (isAnnotatedWith(field, DTO_CREATE_REQUIRED)) {
      overrides.isRequired = true;
    }

    overrides.isNullable =
      overrides.isNullable ?? !(field.isRequired || overrides.isRequired);

    if (isType(field)) {
      // don't try to import the class we're preparing params for
      if (
        field.type !== model.name &&
        !(
          (isAnnotatedWith(field, DTO_OVERRIDE_TYPE) ||
            isAnnotatedWith(field, DTO_CAST_TYPE)) &&
          isAnnotatedWith(field, DTO_OVERRIDE_API_PROPERTY_TYPE)
        )
      ) {
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

        imports.push({
          destruct: [
            importName,
            ...(templateHelpers.config.wrapRelationsAsType
              ? [`type ${importName} as ${importName}AsType`]
              : []),
          ],
          from: importFrom,
        });
      }
    }

    if (templateHelpers.config.classValidation) {
      if (isAnnotatedWith(field, DTO_CREATE_VALIDATE_IF)) {
        overrides.documentation = (
          overrides.documentation ?? field.documentation
        )?.replace(DTO_CREATE_VALIDATE_IF, '@ValidateIf');
      }
      decorators.classValidators = parseClassValidators(
        {
          ...field,
          ...overrides,
        },
        overrides.type || templateHelpers.createDtoName,
      );
      concatUniqueIntoArray(
        decorators.classValidators,
        classValidators,
        'name',
      );
    }

    if (!templateHelpers.config.noDependencies) {
      if (isAnnotatedWith(field, DTO_API_HIDDEN)) {
        decorators.apiHideProperty = true;
      } else {
        // If outputApiPropertyType is false, make sure to set includeType false, otherwise use negated overrides.type
        const includeType = templateHelpers.config.outputApiPropertyType
          ? !overrides.type
          : false;
        decorators.apiProperties = parseApiProperty(
          {
            ...field,
            ...overrides,
          },
          {
            type: includeType,
          },
        );
        if (overrides.type && templateHelpers.config.outputApiPropertyType)
          decorators.apiProperties.push({
            name: 'type',
            value: overrides.type,
            noEncapsulation: true,
          });
        const typeProperty = decorators.apiProperties.find(
          (p) => p.name === 'type',
        );
        if (typeProperty?.value === field.type)
          typeProperty.value =
            '() => ' +
            (field.type === 'Json'
              ? 'Object'
              : templateHelpers.createDtoName(typeProperty.value));
      }
    }

    if (templateHelpers.config.noDependencies) {
      if (field.type === 'Json') field.type = 'Object';
      else if (field.type === 'Decimal') field.type = 'String';

      if (field.kind === 'enum') {
        imports.push({
          from: slash(
            `${getRelativePath(
              model.output.entity,
              templateHelpers.config.outputPath,
            )}${path.sep}enums`,
          ),
          destruct: [field.type],
        });
      }
    }

    return [...result, mapDMMFToParsedField(field, overrides, decorators)];
  }, [] as ParsedField[]);

  const importPrismaClient = makeImportsFromPrismaClient(
    fields,
    templateHelpers.config.prismaClientImportPath,
    !templateHelpers.config.noDependencies,
  );
  const importNestjsSwagger = makeImportsFromNestjsSwagger(
    fields,
    apiExtraModels,
  );
  const importClassValidator = makeImportsFromClassValidator(classValidators);
  const customImports = makeCustomImports(fields);

  return {
    model,
    fields,
    imports: zipImportStatementParams([
      ...importPrismaClient,
      ...importNestjsSwagger,
      ...importClassValidator,
      ...customImports,
      ...imports,
    ]),
    extraClasses,
    apiExtraModels,
  };
};
