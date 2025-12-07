import type { TemplateHelpers } from './template-helpers';
import type { ConnectDtoParams } from './types';

interface GenerateConnectDtoParam extends ConnectDtoParams {
  exportRelationModifierClasses: boolean;
  templateHelpers: TemplateHelpers;
}
export const generateConnectDto = ({
  model,
  fields,
  imports,
  extraClasses,
  apiExtraModels,
  exportRelationModifierClasses,
  templateHelpers: t,
}: GenerateConnectDtoParam) => `
${t.importStatements(imports)}

${t.each(
  extraClasses,
  exportRelationModifierClasses ? (content) => `export ${content}` : t.echo,
  '\n',
)}

${t.if(apiExtraModels.length, t.apiExtraModels(apiExtraModels))}
export ${t.config.outputType} ${t.connectDtoName(model.name)} {
  ${t.fieldsToDtoProps(fields, 'plain', true, false)}
}
`;
