import { TemplateHelpers } from '../template-helpers';
import { computeConnectDtoParams } from './compute-connect-dto-params';
import { computeCreateDtoParams } from './compute-create-dto-params';
import { computeEntityParams } from './compute-entity-params';
import { computePlainDtoParams } from './compute-plain-dto-params';
import { computeUpdateDtoParams } from './compute-update-dto-params';

import type { Model, ModelParams } from '../types';

interface ComputeModelParamsParam {
  model: Model;
  allModels: Model[];
  templateHelpers: TemplateHelpers;
  forceIdOnConnect?: boolean;
}
export const computeModelParams = ({
  model,
  allModels,
  templateHelpers,
  forceIdOnConnect = false,
}: ComputeModelParamsParam): ModelParams => ({
  // TODO find out if model needs `ConnectDTO`
  connect: computeConnectDtoParams({
    model,
    templateHelpers,
    forceIdOnConnect,
  }),
  create: computeCreateDtoParams({
    model,
    allModels, // ? should this be `allModels: models` instead
    templateHelpers,
  }),
  update: computeUpdateDtoParams({
    model,
    allModels,
    templateHelpers,
  }),
  entity: computeEntityParams({
    model,
    allModels,
    templateHelpers,
  }),
  plain: computePlainDtoParams({
    model,
    allModels,
    templateHelpers,
  }),
});
