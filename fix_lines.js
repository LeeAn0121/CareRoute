const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

code = code.replace(
  `            )}
        )}
      </div>`,
  `            )}
          </div>
        )}
      </div>`
);
fs.writeFileSync('src/app/page.tsx', code);
