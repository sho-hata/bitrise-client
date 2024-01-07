import * as vscode from 'vscode';
import axios from 'axios';

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

export const startBitriseBuild = async ({
  branchName,
  workflowId,
}: {
  branchName: string;
  workflowId: string;
}) => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Please set apiToken and defaultAppSlug in settings.');
  }
  const { apiToken, appSlug } = params;

  const url = `https://api.bitrise.io/v0.1/apps/${appSlug}/builds`;

  const requestBody = {
    build_params: {
      branch: branchName,
      workflow_id: workflowId,
    },
    hook_info: {
      type: 'bitrise',
    },
  };

  try {
    await axios.post(url, requestBody, {
      headers: {
        accept: 'application/json',
        Authorization: `${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    return;
  } catch (error) {
    throw new Error('Failed to start build: ' + error);
  }
};

export const fetchBitriseWorkflows = async (): Promise<string[]> => {
  const params = getBitriseClientEnvParams();
  if (!params) {
    throw new Error('Please set apiToken and defaultAppSlug in settings.');
  }
  const { apiToken, appSlug } = params;

  const url = `https://api.bitrise.io/v0.1/apps/${appSlug}/build-workflows`;

  type BitriseWorkflow = {
    data: string[];
  };

  try {
    const response = await axios.get<BitriseWorkflow>(url, {
      headers: {
        Authorization: `${apiToken}`,
      },
    });

    const workflows = response.data.data.map((workflow: string) => workflow);
    return workflows;
  } catch (error) {
    console.error('Error fetching Bitrise workflows:', error);
    throw new Error('Failed to fetch Bitrise workflows');
  }
};
