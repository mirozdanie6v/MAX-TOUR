from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

path = Path('src/worker/index.ts')
text = path.read_text()
text = replace_once(
    text,
    "import { assertTrustedMutationRequest } from './services/request-security';\nimport { managerStatusSchema } from '../shared/schemas';",
    "import { assertTrustedMutationRequest } from './services/request-security';\nimport { cleanupExpiredDemoSessions } from './services/maintenance';\nimport { managerStatusSchema } from '../shared/schemas';",
    'maintenance import',
)
text = replace_once(
    text,
    "    }\n  }\n} satisfies ExportedHandler<Env>;",
    "    }\n  },\n\n  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {\n    ctx.waitUntil(\n      cleanupExpiredDemoSessions(env)\n        .then(result => console.log('scheduled_demo_cleanup', JSON.stringify(result)))\n        .catch(error => console.error('scheduled_demo_cleanup_failed', error instanceof Error ? error.message : 'unknown')),\n    );\n  }\n} satisfies ExportedHandler<Env>;",
    'scheduled handler',
)
path.write_text(text)
print('scheduled maintenance wired')
