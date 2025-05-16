import fs from 'node:fs/promises';
import path from 'node:path';
import makeDir from 'make-dir';
import slash from 'slash';
import { generatorHandler, GeneratorOptions } from '@prisma/generator-helper';
import { WritableDeep } from 'type-fest';
import prettier from 'prettier';
import { logger, parseEnvValue, warn } from './utils';
import { run } from './generator';
import type { WriteableFileSpecs, NamingStyle } from './generator/types';
import { isAnnotatedWith } from './generator/field-classifiers';
import { DTO_CAST_TYPE } from './generator/annotations';

const stringToBoolean = (
  input: string | string[] | undefined,
  defaultValue = false,
) => {
  if (input === 'true') {
    return true;
  }
  if (input === 'false') {
    return false;
  }

  return defaultValue;
};

export const generate = async (options: WritableDeep<GeneratorOptions>) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const output = parseEnvValue(options.generator.output!);
  if (!output) {
    throw new Error('Failed to parse output path');
  }

  const {
    connectDtoPrefix = 'Connect',
    createDtoPrefix = 'Create',
    updateDtoPrefix = 'Update',
    dtoSuffix = 'Dto',
    entityPrefix = '',
    entitySuffix = '',
    fileNamingStyle = 'camel',
    outputType = 'class',
    generateFileTypes = 'all',
  } = options.generator.config;

  const exportRelationModifierClasses = stringToBoolean(
    options.generator.config.exportRelationModifierClasses,
    true,
  );

  const outputToNestJsResourceStructure = stringToBoolean(
    options.generator.config.outputToNestJsResourceStructure,
    // using `true` as default value would be a breaking change
    false,
  );

  const flatResourceStructure = stringToBoolean(
    options.generator.config.flatResourceStructure,
    // using `true` as default value would be a breaking change
    false,
  );

  const reExport = stringToBoolean(
    options.generator.config.reExport,
    // using `true` as default value would be a breaking change
    false,
  );

  const supportedFileNamingStyles = ['kebab', 'camel', 'pascal', 'snake'];
  const isSupportedFileNamingStyle = (style: string): style is NamingStyle =>
    supportedFileNamingStyles.includes(style);

  if (!isSupportedFileNamingStyle(fileNamingStyle as string)) {
    throw new Error(
      `'${fileNamingStyle}' is not a valid file naming style. Valid options are ${supportedFileNamingStyles
        .map((s) => `'${s}'`)
        .join(', ')}.`,
    );
  }

  const classValidation = stringToBoolean(
    options.generator.config.classValidation,
    // using `true` as default value would be a breaking change
    false,
  );

  const supportedOutputTypes = ['class', 'interface'];
  if (!supportedOutputTypes.includes(outputType as string)) {
    throw new Error(
      `'${outputType}' is not a valid output type. Valid options are 'class' and 'interface'.`,
    );
  }

  const noDependencies = stringToBoolean(
    options.generator.config.noDependencies,
    // using `true` as default value would be a breaking change
    false,
  );

  if (classValidation && outputType !== 'class') {
    throw new Error(
      `To use 'classValidation' decorators, 'outputType' must be 'class'.`,
    );
  }

  if (classValidation && noDependencies) {
    throw new Error(
      `To use 'classValidation' decorators, 'noDependencies' cannot be false.`,
    );
  }

  const definiteAssignmentAssertion = stringToBoolean(
    options.generator.config.definiteAssignmentAssertion,
    false,
  );
  if (definiteAssignmentAssertion && outputType !== 'class') {
    throw new Error(
      `To use 'definiteAssignmentAssertion', 'outputType' must be 'class'.`,
    );
  }

  const requiredResponseApiProperty = stringToBoolean(
    options.generator.config.requiredResponseApiProperty,
    true,
  );

  const prismaClientGenerator = options.otherGenerators.find(
    (config) => config.name === 'client',
  );
  const prismaClientOutputPath = prismaClientGenerator?.output?.value;
  let prismaClientImportPath =
    options.generator.config.prismaClientImportPath || '@prisma/client';
  if (
    !options.generator.config.prismaClientImportPath &&
    prismaClientOutputPath &&
    !prismaClientOutputPath.endsWith(
      ['node_modules', '@prisma', 'client'].join(path.sep),
    )
  ) {
    const withStructure = outputToNestJsResourceStructure
      ? flatResourceStructure
        ? '../'
        : '../../'
      : '';
    prismaClientImportPath = slash(
      withStructure + path.relative(output, prismaClientOutputPath),
    );
    if (!prismaClientImportPath.startsWith('.')) {
      prismaClientImportPath = './' + prismaClientImportPath;
    }
  }

  const outputApiPropertyType = stringToBoolean(
    options.generator.config.outputApiPropertyType,
    true,
  );
  if (!outputApiPropertyType) {
    warn(
      '`outputApiPropertyType = "false"` is deprecated. Please use `wrapRelationsAsType = "true"` instead and report any issues.',
    );
  }

  const wrapRelationsAsType = stringToBoolean(
    options.generator.config.wrapRelationsAsType,
    false,
  );

  const showDefaultValues = stringToBoolean(
    options.generator.config.showDefaultValues,
    false,
  );

  const results = run({
    output,
    dmmf: options.dmmf,
    exportRelationModifierClasses,
    outputToNestJsResourceStructure,
    flatResourceStructure,
    connectDtoPrefix: connectDtoPrefix as string,
    createDtoPrefix: createDtoPrefix as string,
    updateDtoPrefix: updateDtoPrefix as string,
    dtoSuffix: dtoSuffix as string,
    entityPrefix: entityPrefix as string,
    entitySuffix: entitySuffix as string,
    fileNamingStyle: fileNamingStyle as NamingStyle,
    classValidation,
    outputType: outputType as string,
    noDependencies,
    definiteAssignmentAssertion,
    requiredResponseApiProperty,
    prismaClientImportPath: prismaClientImportPath as string,
    outputApiPropertyType,
    generateFileTypes: generateFileTypes as string,
    wrapRelationsAsType,
    showDefaultValues,
  });

  // check for deprecated annotations
  const deprecatedCastTypeAnnotation = [
    ...options.dmmf.datamodel.models,
    ...options.dmmf.datamodel.types,
  ].some((model) =>
    model.fields.some((field) => isAnnotatedWith(field, DTO_CAST_TYPE)),
  );
  if (deprecatedCastTypeAnnotation) {
    warn(
      '@DtoCastType annotation is deprecated. Please use DtoOverrideType instead.',
    );
  }

  const indexCollections: Record<string, WriteableFileSpecs> = {};

  if (reExport) {
    results.forEach(({ fileName }) => {
      const dirName = path.dirname(fileName);

      const { [dirName]: fileSpec } = indexCollections;
      indexCollections[dirName] = {
        fileName: fileSpec?.fileName || path.join(dirName, 'index.ts'),
        content: [
          fileSpec?.content || '',
          `export * from './${path.basename(fileName, '.ts')}';`,
        ].join('\n'),
      };
    });

    // combined index.ts in root output folder
    if (outputToNestJsResourceStructure) {
      const content: string[] = [];
      Object.entries(indexCollections)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([dirName, file]) => {
          if (output === dirName) {
            content.push(file.content);
          } else {
            const base = dirName
              .split(/[\\\/]/)
              .slice(flatResourceStructure ? -1 : -2);
            content.push(
              `export * from './${base[0]}${base[1] ? '/' + base[1] : ''}';`,
            );
          }
        });
      indexCollections[output] = {
        fileName: path.join(output, 'index.ts'),
        content: content.join('\n'),
      };
    }
  }

  const applyPrettier = stringToBoolean(
    options.generator.config.prettier,
    false,
  );

  let prettierConfig: prettier.Options = {};
  if (applyPrettier) {
    const prettierConfigFile = await prettier.resolveConfigFile();
    if (!prettierConfigFile) {
      logger('Stylizing output DTOs with the default Prettier config.');
    } else {
      logger(
        `Stylizing output DTOs with found Prettier config. (${prettierConfigFile})`,
      );
    }

    if (prettierConfigFile) {
      const resolvedConfig = await prettier.resolveConfig(prettierConfigFile, {
        config: prettierConfigFile,
      });

      if (resolvedConfig) prettierConfig = resolvedConfig;
    }

    // Ensures that there are no parsing issues
    // We know that the output files are always TypeScript
    prettierConfig.parser = 'typescript';
  }

  return Promise.all(
    results
      .concat(Object.values(indexCollections))
      .map(async ({ fileName, content }) => {
        await makeDir(path.dirname(fileName));

        if (applyPrettier) {
          content = await prettier.format(content, prettierConfig);
        }

        return fs.writeFile(fileName, content);
      }),
  );
};

generatorHandler({
  onManifest: () => ({
    defaultOutput: '../src/generated/nestjs-dto',
    prettyName: 'NestJS DTO Generator',
  }),
  onGenerate: generate,
});
