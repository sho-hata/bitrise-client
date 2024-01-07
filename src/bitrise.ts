import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';

type BitriseClientEnvParams = {
  apiToken: string;
  appSlug: string;
};

const getBitriseClientEnvParams = (): BitriseClientEnvParams | undefined => {
  const config = vscode.workspace.getConfiguration('bitrise-client');
  const apiToken = config.get<string>('apiToken');
  const appSlug = config.get<string>('defaultAppSlug');

  if (!apiToken || !appSlug) {
    return undefined;
  }

  return { apiToken, appSlug };
};

const makeBitriseApiCall = async <T>(
  method: 'get' | 'post',
  endpoint: string,
  params: BitriseClientEnvParams,
  data?: any
): Promise<AxiosResponse<T>> => {
  const { apiToken, appSlug } = params;
  const url = `https://api.bitrise.io/v0.1/apps/${appSlug}${endpoint}`;

  try {
    return await axios({
      method,
      url,
      headers: {
        Authorization: `${apiToken}`,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      data,
    });
  } catch (error) {
    console.error(`Error during Bitrise API call to ${endpoint}:`, error);
    throw new Error(`Bitrise API call failed: ${error}`);
  }
};

export const startBitriseBuild = async ({
  branchName,
  workflowId,
}: {
  branchName: string;
  workflowId: string;
}) => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Bitrise client environment params not found.');
  }

  const requestBody = {
    build_params: {
      branch: branchName,
      workflow_id: workflowId,
    },
    hook_info: {
      type: 'bitrise',
    },
  };

  await makeBitriseApiCall('post', '/builds', params, requestBody);
};

export const fetchBitriseWorkflows = async (): Promise<string[]> => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Bitrise client environment params not found.');
  }

  const response = await makeBitriseApiCall<{ data: string[] }>(
    'get',
    '/build-workflows',
    params
  );
  return response.data.data;
};

export const fetchBitriseNotFinishedBuildSlugs = async (): Promise<
  string[]
> => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Bitrise client environment params not found.');
  }

  const requestParams = {
    status: 0,
  };

  const response = await makeBitriseApiCall<{ data: string[] }>(
    'get',
    '/builds',
    params,
    requestParams
  );
  return response.data.data.map((slug) => slug);
};

export const abortBitriseBuild = async (buildSlug: string) => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Bitrise client environment params not found.');
  }

  await makeBitriseApiCall('post', `/builds/${buildSlug}/abort`, params);
};
