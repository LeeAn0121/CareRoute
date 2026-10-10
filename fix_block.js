const fs = require('fs');
let code = fs.readFileSync('src/app/page.tsx', 'utf-8');

// I will find the exact lines 1894 to 1898 and look at them.
// Wait, I can just replace `)}` with `))}` at the end of the list.
const errorBlock = `                  );
                })}
              </div>
            )}`;

const fixedBlock = `                  );
                })}
              </div>
            ))}`;

code = code.replace(errorBlock, fixedBlock);
fs.writeFileSync('src/app/page.tsx', code);
