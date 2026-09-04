# Contributing to YouTube Shield

First off, thank you for considering contributing to YouTube Shield! It's people like you that make YouTube Shield a powerful tool for focused learning and audio mastery.

## Development Setup

1. Fork the repo and clone it locally:
   ```bash
   git clone https://github.com/Shivaramnnp/shorts-shield.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the extension directory.
5. Make your code changes.
6. Run the test suite:
   ```bash
   npm test
   # Or run full stress tests
   npm run test:all
   ```

## Pull Request Process

1. Ensure all tests pass (`npm run build` and `npm run test:all`).
2. Keep performance in mind. Do not introduce global `MutationObservers` or heavy computations on the main thread.
3. Update `README.md` and `CHANGELOG.md` with details of changes.
4. Submit your PR on GitHub: [https://github.com/Shivaramnnp/shorts-shield](https://github.com/Shivaramnnp/shorts-shield)

## Contact & Bug Reports

* **Author:** Shivaram
* **Email:** [`shivaramnnp@gmail.com`](mailto:shivaramnnp@gmail.com)
* **LinkedIn:** [https://www.linkedin.com/in/shivaramnnp/](https://www.linkedin.com/in/shivaramnnp/)
