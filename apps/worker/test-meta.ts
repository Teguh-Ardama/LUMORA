import { config } from 'dotenv'; config({ path: '../../.env' }); import { getStorage } from '@lumora/core'; console.log(getStorage());  
