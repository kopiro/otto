import React from "react"
import ReactDOM from "react-dom"

import moment from "moment"

class CronTable extends React.Component {

	constructor(props) {
		super(props);
		this.state = {
			elements: []
		};
	}

	componentDidMount() {
		fetch('/api/cron')
		.then((resp) => {
			resp.json().then((json) => {
				this.setState({
					elements: json.data
				});
			});
		});
	}

	render() {
		return (
		<table className="striped bordered">
		<thead>
			<th>ID</th>
			<th>Weekdays</th>
			<th>Hours</th>
			<th>Minutes</th>
			<th>Text</th>
		</thead>
		<tbody>
		{ 
			this.state.elements.map((el) => {
				return (
				<tr key={ el.id }>
					<td>{ el.id }</td>
					<td>{ el.iso_weekday.split(',').map((e) => <div className="chip">{ e }</div>) }</td>
					<td>{ el.hours.split(',').map((e) => <div className="chip">{ e }</div>) }</td>
					<td>{ el.minutes.split(',').map((e) => <div className="chip">{ e }</div>) }</td>
					<td>{ el.text }</td>
				</tr>
				);
			}) 
		}
		</tbody>
		</table>
		);
	}

}

ReactDOM.render(<CronTable />, document.getElementById('main-table'));