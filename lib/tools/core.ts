/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { FunctionCall } from '../state';
import { FunctionResponseScheduling } from '@google/genai';

export const coreTools: FunctionCall[] = [
  {
    name: 'save_memory',
    description:
      'Saves a piece of information to your long-term memory about the user. Use this ONLY when the user explicitly asks you to remember, note, or not forget something.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text_to_remember: {
          type: 'STRING',
          description:
            'The specific fact or piece of information to save to memory.',
        },
      },
      required: ['text_to_remember'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.SILENT,
  },
  {
    name: 'launch_app',
    description:
      "Launches one of the user's installed applications in a full-screen view.",
    parameters: {
      type: 'OBJECT',
      properties: {
        app_name: {
          type: 'STRING',
          description:
            "The exact title of the app to launch from the list of installed applications.",
        },
      },
      required: ['app_name'],
    },
    isEnabled: true,
    scheduling: FunctionResponseScheduling.INTERRUPT,
  },
];