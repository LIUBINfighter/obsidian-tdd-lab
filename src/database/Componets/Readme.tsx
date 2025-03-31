import { h, Component } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

export class Readme extends Component {
    render() {
        return html`
            <div class="readme-container">
                <h2>TDD Lab 数据库</h2>
                <p>欢迎使用TDD Lab数据库视图。这个界面可以帮助您管理测试驱动开发工作流。</p>
                <div class="readme-section">
                    <h3>使用指南</h3>
                    <p>使用此面板跟踪您的测试、实现和开发进度。</p>
                </div>
            </div>
        `;
    }
}
