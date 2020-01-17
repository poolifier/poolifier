const FixedThreadPool = require('./fixed')

const o = {
  a: 'asdfsadfafdgmnsdfmnbgsdfgbsdfmnbgsdfmnbgsmd,fbgsmndfbg'
}
const pool = new FixedThreadPool(3)
pool.execute(JSON.stringify, o).then(res => console.log(res))
