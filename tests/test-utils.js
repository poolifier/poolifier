class TestUtils {
  static async sleep (milliSeconds) {
    return new Promise(resolve => setTimeout(resolve, milliSeconds))
  }
}

module.exports = TestUtils
