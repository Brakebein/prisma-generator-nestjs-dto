import path from 'node:path';
import slash from 'slash';
import {
  DTO_API_HIDDEN,
  DTO_OVERRIDE_API_PROPERTY_TYPE,
  DTO_CAST_TYPE,
  DTO_OVERRIDE_TYPE,
  DTO_RELATION_CAN_CONNECT_ON_UPDATE,
  DTO_RELATION_CAN_CREATE_ON_UPDATE,
  DTO_RELATION_CAN_UPDATE_ON_UPDATE,
  DTO_RELATION_CAN_DISCONNECT_ON_UPDATE,
  DTO_RELATION_INCLUDE_ID,
  DTO_RELATION_MODIFIERS_ON_UPDATE,
  DTO_TYPE_FULL_UPDATE,
  DTO_UPDATE_HIDDEN,
  DTO_UPDATE_OPTIONAL,
  DTO_UPDATE_REQUIRED,
  DTO_UPDATE_VALIDATE_IF,
} from '../annotations';
import {
  isAnnotatedWith,
  isAnnotatedWithOneOf,
  isId,
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
import {
  makeImportsFromNestjsSwagger,
  parseApiProperty,
} from '../api-decorator';
import {
  makeImportsFromClassValidator,
  parseClassValidators,
} from '../class-validator';
import type { TemplateHelpers } from '../template-helpers';
import type {
  IClassValidator,
  IDecorators,
  ImportStatementParams,
  Model,
  ParsedField,
  UpdateDtoParams,
} from '../types';

interface ComputeUpdateDtoParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
}
export const computeUpdateDtoParams = ({
  model,
  allModels,
  templateHelpers,
}: ComputeUpdateDtoParamsParam): UpdateDtoParams => {
  const imports: ImportStatementParams[] = [];
  const extraClasses: string[] = [];
  const apiExtraModels: string[] = [];
  const classValidators: IClassValidator[] = [];

  const relationScalarFields = getRelationScalars(model.fields);
  const relationScalarFieldNames = Object.keys(relationScalarFields);

  const fields = model.fields.reduce((result, field) => {
    const { name } = field;
    const overrides: Partial<ParsedField> = {
      isRequired: false,
      isNullable: !field.isRequired,
    };
    const decorators: IDecorators = {};

    if (
      isAnnotatedWith(field, DTO_RELATION_INCLUDE_ID) &&
      relationScalarFieldNames.includes(name)
    )
      field.isReadOnly = false;

    if (isReadOnly(field)) return result;
    if (isAnnotatedWith(field, DTO_UPDATE_HIDDEN)) return result;
    if (isRelation(field)) {
      if (!isAnnotatedWithOneOf(field, DTO_RELATION_MODIFIERS_ON_UPDATE)) {
        return result;
      }
      const relationInputType = generateRelationInput({
        field,
        model,
        allModels,
        templateHelpers,
        preAndSuffixClassName: templateHelpers.updateDtoName,
        canCreateAnnotation: DTO_RELATION_CAN_CREATE_ON_UPDATE,
        canConnectAnnotation: DTO_RELATION_CAN_CONNECT_ON_UPDATE,
        canUpdateAnnotation: DTO_RELATION_CAN_UPDATE_ON_UPDATE,
        canDisconnectAnnotation: DTO_RELATION_CAN_DISCONNECT_ON_UPDATE,
      });

      overrides.type = relationInputType.type;
      overrides.pureType = true;
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
    // as **not** required in UpdateDTO
    const isDtoOptional = isAnnotatedWithOneOf(field, [
      DTO_UPDATE_OPTIONAL,
      DTO_UPDATE_REQUIRED,
    ]);
    const doFullUpdate = isAnnotatedWith(field, DTO_TYPE_FULL_UPDATE);

    if (!isDtoOptional) {
      if (isId(field)) return result;
      if (isUpdatedAt(field)) return result;
      if (isRequiredWithDefaultValue(field)) {
        if (templateHelpers.config.showDefaultValues)
          overrides.isRequired = false;
        else return result;
      }
    }

    if (isAnnotatedWith(field, DTO_UPDATE_REQUIRED)) {
      overrides.isRequired = true;
    }

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

        const importName = doFullUpdate
          ? templateHelpers.createDtoName(field.type)
          : templateHelpers.updateDtoName(field.type);
        const importFrom = slash(
          `${getRelativePath(model.output.dto, modelToImportFrom.output.dto)}${
            path.sep
          }${
            doFullUpdate
              ? templateHelpers.createDtoFilename(field.type)
              : templateHelpers.updateDtoFilename(field.type)
          }`,
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
      if (isAnnotatedWith(field, DTO_UPDATE_VALIDATE_IF)) {
        overrides.documentation = (
          overrides.documentation ?? field.documentation
        )?.replace(DTO_UPDATE_VALIDATE_IF, '@ValidateIf');
      }
      decorators.classValidators = parseClassValidators(
        {
          ...field,
          ...overrides,
        },
        overrides.type ||
          (isType(field) && doFullUpdate
            ? templateHelpers.createDtoName
            : templateHelpers.updateDtoName),
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
            isNullable: overrides.isNullable ?? !field.isRequired,
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
              : doFullUpdate
                ? templateHelpers.createDtoName(typeProperty.value)
                : templateHelpers.updateDtoName(typeProperty.value));
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

    return [
      ...result,
      mapDMMFToParsedField(
        field,
        { ...overrides, modelName: model.name },
        decorators,
      ),
    ];
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
