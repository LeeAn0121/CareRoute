const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

const duplicate = `              <IconPlus size={32} strokeWidth={2.5} />
            </button>
            )}
              <IconPlus size={32} strokeWidth={2.5} />
            </button>`;
const fixed = `              <IconPlus size={32} strokeWidth={2.5} />
              </button>
            )}`;

code = code.replace(duplicate, fixed);
fs.writeFileSync('src/app/page.tsx', code);
